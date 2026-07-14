use futures_util::StreamExt;
use reqwest::Response;

/// Incremental line-buffering state machine: feed it bytes as they arrive
/// over the wire, and it calls `on_data` for each complete `data: ...` line,
/// holding any trailing partial line in its buffer until the next `feed`.
/// Split out from `for_each_sse_data_line` so the parsing logic is testable
/// without a real HTTP response.
struct SseLineParser {
    buf: String,
}

impl SseLineParser {
    fn new() -> Self {
        Self { buf: String::new() }
    }

    fn feed(&mut self, chunk: &[u8], mut on_data: impl FnMut(&str)) {
        self.buf.push_str(&String::from_utf8_lossy(chunk));

        while let Some(newline_pos) = self.buf.find('\n') {
            let line = self.buf[..newline_pos].trim_end_matches('\r').to_string();
            self.buf.drain(..=newline_pos);

            if let Some(data) = line.strip_prefix("data:") {
                let data = data.trim();
                if !data.is_empty() {
                    on_data(data);
                }
            }
        }
    }
}

/// Reads a Server-Sent-Events response body and invokes `on_data` with the
/// payload of each `data: ...` line as it completes. Lines that aren't a
/// `data:` line (e.g. `event:` names, blank keep-alives) are ignored —
/// providers that need the event name encode it inside the JSON payload
/// itself (e.g. Anthropic's `type` field), so nothing is lost by dropping it.
pub async fn for_each_sse_data_line<F>(response: Response, mut on_data: F) -> Result<(), String>
where
    F: FnMut(&str),
{
    let mut stream = response.bytes_stream();
    let mut parser = SseLineParser::new();

    while let Some(chunk) = stream.next().await {
        let chunk = chunk.map_err(|e| format!("Stream error: {e}"))?;
        parser.feed(&chunk, &mut on_data);
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_single_line_data_events() {
        let mut parser = SseLineParser::new();
        let mut received = Vec::new();
        parser.feed(b"data: {\"a\":1}\n\n", |d| received.push(d.to_string()));
        assert_eq!(received, vec!["{\"a\":1}"]);
    }

    #[test]
    fn buffers_partial_lines_across_chunks() {
        let mut parser = SseLineParser::new();
        let mut received = Vec::new();
        parser.feed(b"data: {\"a\"", |d| received.push(d.to_string()));
        parser.feed(b":1}\n\n", |d| received.push(d.to_string()));
        assert_eq!(received, vec!["{\"a\":1}"]);
    }

    #[test]
    fn ignores_non_data_lines() {
        let mut parser = SseLineParser::new();
        let mut received = Vec::new();
        parser.feed(b"event: message_start\ndata: {\"x\":true}\n\n", |d| {
            received.push(d.to_string())
        });
        assert_eq!(received, vec!["{\"x\":true}"]);
    }

    #[test]
    fn skips_empty_data_lines() {
        let mut parser = SseLineParser::new();
        let mut received = Vec::new();
        parser.feed(b"data: \n\ndata: real\n\n", |d| received.push(d.to_string()));
        assert_eq!(received, vec!["real"]);
    }

    #[test]
    fn handles_openai_done_sentinel_as_plain_data() {
        // The [DONE] sentinel isn't JSON — the parser just passes it through
        // as a data payload; callers decide what to do with it.
        let mut parser = SseLineParser::new();
        let mut received = Vec::new();
        parser.feed(b"data: [DONE]\n\n", |d| received.push(d.to_string()));
        assert_eq!(received, vec!["[DONE]"]);
    }
}
