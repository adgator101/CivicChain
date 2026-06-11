import { requireUser } from "@/lib/session";
import { OfflineReportForm } from "@/components/civic/offline-report-form";
import { OfflineOutbox } from "@/components/civic/offline-outbox";

// A lightweight, offline-first complaint screen — installable as a PWA. Works in
// dead zones: the form saves to the phone and syncs automatically on reconnect.
export const metadata = {
  title: "Quick report — CivicChain",
};

export default async function OfflineReportPage() {
  const user = await requireUser();

  return (
    <div className="mx-auto w-full max-w-xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Quick report</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          A fast way to file a complaint — even with no signal. Your report is saved
          on your phone and sent automatically once you&apos;re back online.
        </p>
      </div>

      <OfflineOutbox />

      <OfflineReportForm
        defaults={{
          wardNumber: user.wardNumber,
          municipalityName: user.municipalityName,
          districtName: user.districtName,
          provinceName: user.provinceName,
        }}
      />
    </div>
  );
}
