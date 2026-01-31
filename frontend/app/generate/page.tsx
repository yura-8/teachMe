import GenerateClient from "./GenerateClient";

export default async function GeneratePage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[linear-gradient(to_top,#fddb92_0%,#d1fdff_100%)] px-4 py-6">
      <GenerateClient />
    </div>
  );
}
