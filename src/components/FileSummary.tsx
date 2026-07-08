import { Cpu, Database, FileScan } from "lucide-react";
import { FAMILY_LABELS } from "../data/conversionMatrix";
import { formatBytes, formatDuration } from "../lib/fileInspection";
import type { DeviceProfile, FileInspection } from "../lib/types";

interface FileSummaryProps {
  inspection: FileInspection;
  device: DeviceProfile | null;
}

export function FileSummary({ inspection, device }: FileSummaryProps) {
  return (
    <aside className="summary-panel">
      <div className="panel-kicker">Local scan</div>
      <h2>{FAMILY_LABELS[inspection.family]}</h2>
      <p className="file-name">{inspection.name}</p>
      <div className="summary-grid">
        <Metric icon={<FileScan size={16} />} label="Type" value={inspection.mime} />
        <Metric icon={<Database size={16} />} label="Size" value={formatBytes(inspection.size)} />
        <Metric icon={<Cpu size={16} />} label="Device" value={device ? `${device.cores} threads${device.memoryGb ? ` / ${device.memoryGb} GB` : ""}` : "Scanning"} />
      </div>
      <div className="meta-list">
        {inspection.width && inspection.height ? <span>{inspection.width} x {inspection.height}</span> : null}
        {inspection.duration ? <span>{formatDuration(inspection.duration)}</span> : null}
      </div>
      <ul className="notes-list">
        {inspection.notes.map((note) => (
          <li key={note}>{note}</li>
        ))}
      </ul>
    </aside>
  );
}

function Metric({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="metric">
      {icon}
      <span>{label}</span>
      <b>{value}</b>
    </div>
  );
}
