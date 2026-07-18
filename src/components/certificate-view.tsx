import { forwardRef } from "react";
import { Sparkles, QrCode, ShieldCheck } from "lucide-react";
import { format } from "date-fns";

export type CertificateData = {
  code: string;
  volunteerName: string;
  eventName: string;
  organizerName: string;
  serviceHours: number;
  issuedAt: string;
  type?: "volunteer" | "organizer";
  organizationName?: string | null;
  volunteersManaged?: number;
};

export const CertificateView = forwardRef<HTMLDivElement, { data: CertificateData }>(({ data }, ref) => {
  const isOrganizer = data.type === "organizer";
  return (
    <div
      ref={ref}
      className="relative mx-auto aspect-[1.414/1] w-full max-w-3xl overflow-hidden rounded-xl border-4 border-primary/20 bg-white p-10 text-slate-900 shadow-card print:shadow-none print:border-primary/40"
      style={{ backgroundImage: "radial-gradient(circle at 20% 20%, rgba(139,92,246,0.08), transparent 40%), radial-gradient(circle at 80% 80%, rgba(59,130,246,0.08), transparent 40%)" }}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="grid h-10 w-10 place-items-center rounded-lg gradient-primary shadow-glow">
            <Sparkles className="h-5 w-5 text-white" />
          </div>
          <span className="text-xl font-semibold tracking-tight">CoVol</span>
        </div>
        <div className="text-right text-xs text-slate-500">
          <p>Certificate ID</p>
          <p className="font-mono font-medium text-slate-700">{data.code}</p>
        </div>
      </div>

      <div className="mt-8 text-center">
        <p className="text-sm uppercase tracking-[0.3em] text-slate-500">
          {isOrganizer ? "Certificate of Recognition" : "Certificate of Appreciation"}
        </p>
        <p className="mt-6 text-sm text-slate-500">This certificate is proudly presented to</p>
        <h1 className="mt-2 text-4xl font-bold tracking-tight text-primary">
          {isOrganizer ? data.organizerName : data.volunteerName}
        </h1>
        {isOrganizer ? (
          <p className="mx-auto mt-6 max-w-xl text-sm leading-relaxed text-slate-600">
            for outstanding leadership of{" "}
            <span className="font-semibold text-slate-900">{data.organizationName || data.eventName}</span>
            {typeof data.volunteersManaged === "number" && (
              <> in organizing <span className="font-semibold text-slate-900">{data.volunteersManaged}</span> volunteer{data.volunteersManaged === 1 ? "" : "s"}</>
            )}
            {" "}across <span className="font-semibold text-slate-900">{data.serviceHours} service hour{data.serviceHours === 1 ? "" : "s"}</span> of community impact.
          </p>
        ) : (
          <p className="mx-auto mt-6 max-w-xl text-sm leading-relaxed text-slate-600">
            in recognition of dedicated volunteer service for{" "}
            <span className="font-semibold text-slate-900">{data.eventName}</span>, contributing{" "}
            <span className="font-semibold text-slate-900">{data.serviceHours} service hour{data.serviceHours === 1 ? "" : "s"}</span> toward the community.
          </p>
        )}
      </div>

      <div className="mt-10 flex items-end justify-between">
        <div className="text-xs">
          <div className="h-px w-40 bg-slate-400" />
          <p className="mt-1 font-medium flex items-center gap-1">
            {isOrganizer ? (<><ShieldCheck className="h-3 w-3" /> CoVol Administrator</>) : data.organizerName}
          </p>
          <p className="text-slate-500">{isOrganizer ? "Digital signature" : "Organizer signature"}</p>
        </div>
        <div className="grid h-20 w-20 place-items-center rounded-lg border border-slate-300 bg-slate-50 text-slate-400">
          <QrCode className="h-10 w-10" />
        </div>
        <div className="text-right text-xs">
          <div className="h-px w-40 bg-slate-400" />
          <p className="mt-1 font-medium">{format(new Date(data.issuedAt), "PPP")}</p>
          <p className="text-slate-500">Issue date</p>
        </div>
      </div>
    </div>
  );
});
CertificateView.displayName = "CertificateView";
