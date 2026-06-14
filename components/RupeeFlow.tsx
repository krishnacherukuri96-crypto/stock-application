"use client";

interface RupeeItem {
  label: string;
  paisa: number;
  color: string;
}

interface RupeeFlowProps {
  receipts: RupeeItem[];
  expenditures: RupeeItem[];
}

function PaiseBar({ items }: { items: RupeeItem[] }) {
  return (
    <div className="w-full flex rounded-lg overflow-hidden h-8">
      {items.map((item, i) => (
        <div
          key={i}
          style={{ width: `${item.paisa}%`, backgroundColor: item.color }}
          className="flex items-center justify-center"
          title={`${item.label}: ${item.paisa} paise`}
        />
      ))}
    </div>
  );
}

export default function RupeeFlow({ receipts, expenditures }: RupeeFlowProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
      {/* Receipts */}
      <div>
        <p className="text-sm font-semibold text-gray-700 mb-3">
          Where does ₹1 come from?
        </p>
        <PaiseBar items={receipts} />
        <div className="mt-4 space-y-2">
          {receipts.map((item, i) => (
            <div key={i} className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span
                  className="w-3 h-3 rounded-full flex-shrink-0"
                  style={{ backgroundColor: item.color }}
                />
                <span className="text-sm text-gray-700">{item.label}</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-24 bg-gray-100 rounded-full h-1.5">
                  <div
                    className="h-1.5 rounded-full"
                    style={{ width: `${item.paisa}%`, backgroundColor: item.color }}
                  />
                </div>
                <span className="text-sm font-semibold text-gray-800 w-12 text-right">
                  {item.paisa}p
                </span>
              </div>
            </div>
          ))}
        </div>
        <p className="text-xs text-gray-400 mt-3">
          p = paise (out of ₹1.00). Borrowings fund 31p of every rupee spent.
        </p>
      </div>

      {/* Expenditures */}
      <div>
        <p className="text-sm font-semibold text-gray-700 mb-3">
          Where does ₹1 go?
        </p>
        <PaiseBar items={expenditures} />
        <div className="mt-4 space-y-2">
          {expenditures.map((item, i) => (
            <div key={i} className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span
                  className="w-3 h-3 rounded-full flex-shrink-0"
                  style={{ backgroundColor: item.color }}
                />
                <span className="text-sm text-gray-700">{item.label}</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-24 bg-gray-100 rounded-full h-1.5">
                  <div
                    className="h-1.5 rounded-full"
                    style={{ width: `${item.paisa}%`, backgroundColor: item.color }}
                  />
                </div>
                <span className="text-sm font-semibold text-gray-800 w-12 text-right">
                  {item.paisa}p
                </span>
              </div>
            </div>
          ))}
        </div>
        <p className="text-xs text-gray-400 mt-3">
          23p of every rupee goes to interest — a structural constraint on growth spending.
        </p>
      </div>
    </div>
  );
}
