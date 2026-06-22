import { Construction } from "lucide-react";

export default function PlaceholderPage({ title, phase }: { title: string; phase: string }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] p-8 text-center">
      <Construction className="w-12 h-12 text-muted-foreground/40 mb-4" />
      <h2 className="text-xl font-semibold text-foreground">{title}</h2>
      <p className="text-sm text-muted-foreground mt-2">该功能将在 {phase} 阶段交付</p>
    </div>
  );
}
