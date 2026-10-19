import { Badge, Empty } from "./ui";
import { dateLabel, money } from "@/lib/ledger";
import type { ArrearsRow } from "@/lib/arrears";

export function ArrearsTable({ rows }: { rows: ArrearsRow[] }) {
  if (!rows.length)
    return (
      <Empty title="No overdue amounts">
        Periods with an unpaid balance after their due date will appear here.
      </Empty>
    );
  const totalUnpaid = rows.reduce((s, r) => s + r.unpaid, 0);
  const interestKnown = rows.every((r) => r.interest !== null);
  const totalInterest = rows.reduce((s, r) => s + (r.interest ?? 0), 0);
  return (
    <div className="table-scroll">
      <table>
        <thead>
          <tr>
            <th>Period / order</th>
            <th>Due date</th>
            <th>Days overdue</th>
            <th>Paid so far</th>
            <th>Last paid on</th>
            <th>Unpaid</th>
            <th>Interest</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={`${r.orderId}-${r.period}`}>
              <td className="strong">
                {new Date(`${r.period}-01T12:00:00Z`).toLocaleDateString(
                  "en-IN",
                  { month: "long", year: "numeric", timeZone: "UTC" },
                )}
                <small>Order #{r.orderId}</small>
              </td>
              <td>{dateLabel(r.dueDate)}</td>
              <td className="numeric">{r.daysOverdue}</td>
              <td className="numeric">{money(r.paid)}</td>
              <td>{r.lastPaidOn ? dateLabel(r.lastPaidOn) : "No payment"}</td>
              <td className="numeric strong text-amber">{money(r.unpaid)}</td>
              <td className="numeric">
                {r.interest === null ? (
                  <Badge tone="neutral">Rule pending</Badge>
                ) : (
                  money(r.interest)
                )}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td className="strong" colSpan={5}>
              Total
            </td>
            <td className="numeric strong">{money(totalUnpaid)}</td>
            <td className="numeric strong">
              {interestKnown ? money(totalInterest) : "Rule pending"}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
