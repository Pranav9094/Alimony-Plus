import type { Role } from "@/lib/filing/types";

const OPTIONS: { value: Role; title: string; text: string }[] = [
  {
    value: "petitioner",
    title: "Petitioner",
    text: "You are the person who starts the case and asks the court for an order.",
  },
  {
    value: "respondent",
    title: "Respondent",
    text: "You are the person responding to a case that someone else has started.",
  },
];

export function StageRole({
  role,
  error,
  onChange,
}: {
  role: Role | "";
  error?: string;
  onChange: (role: Role) => void;
}) {
  return (
    <fieldset className="f-fieldset" aria-describedby={error ? "role-error" : "role-hint"}>
      <legend>Which of these describes you?</legend>
      <p id="role-hint" className="f-hint">
        Your answer changes the wording and some of the questions later. If you are not sure,
        check the court papers you received.
      </p>
      <div className="f-choices">
        {OPTIONS.map((o) => (
          <label key={o.value} className="f-choice">
            <input
              type="radio"
              name="role"
              value={o.value}
              checked={role === o.value}
              onChange={() => onChange(o.value)}
            />
            <span>
              <strong>{o.title}</strong>
              <span className="f-choice-text">{o.text}</span>
            </span>
          </label>
        ))}
      </div>
      {error ? (
        <p id="role-error" className="f-error" role="alert">
          Error: {error}
        </p>
      ) : null}
    </fieldset>
  );
}