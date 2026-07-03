const FEEDBACK_FORM_URL = "https://forms.gle/tahNmZ7aWskJo5TP9";

type FeedbackFormProps = {
  walletAddress: string | null;
};

export function FeedbackForm({ walletAddress }: FeedbackFormProps) {
  return (
    <section className="feedback-form">
      <h2>Feedback</h2>
      <p className="panel-help">
        {walletAddress
          ? "Tried the demo? Tell us what you thought — it takes about a minute."
          : "Connect a wallet and try the demo, then leave feedback here."}
      </p>
      <a
        className="feedback-submit-button feedback-link-button"
        href={FEEDBACK_FORM_URL}
        target="_blank"
        rel="noreferrer"
      >
        Open feedback form
      </a>
    </section>
  );
}
