import { open } from "@tauri-apps/plugin-dialog";

export async function pickPdfPath(): Promise<string | null> {
  const result = await open({
    multiple: false,
    filters: [{ name: "PDF", extensions: ["pdf"] }],
  });
  return typeof result === "string" ? result : null;
}
