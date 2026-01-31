// Minimal `cn` helper inspired by shadcn/ui.
// We intentionally avoid external deps (clsx/tailwind-merge) in this repo.
export function cn(...inputs: Array<string | false | null | undefined>) {
  return inputs.filter(Boolean).join(" ");
}
