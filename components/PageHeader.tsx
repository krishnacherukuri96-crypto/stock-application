interface PageHeaderProps {
  title: string;
  description: string;
  lastUpdated?: string;
  source?: string;
}

export default function PageHeader({ title, description, lastUpdated, source }: PageHeaderProps) {
  return (
    <div className="mb-6">
      <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
      <p className="mt-1 text-sm text-gray-500">{description}</p>
      {(lastUpdated || source) && (
        <div className="mt-2 flex items-center gap-3 text-xs text-gray-400">
          {source && <span>Source: {source}</span>}
          {lastUpdated && <span>· Updated: {new Date(lastUpdated).toLocaleDateString("en-IN")}</span>}
        </div>
      )}
    </div>
  );
}
