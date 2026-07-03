import { FormEvent, useEffect, useState } from "react";

type FeedbackSubmission = {
  name: string;
  walletAddress: string;
  rating: number;
  comment: string;
  submittedAt: string;
};

const feedbackSubmissions: FeedbackSubmission[] = [];

type FeedbackFormProps = {
  walletAddress: string | null;
};

export function FeedbackForm({ walletAddress }: FeedbackFormProps) {
  const [name, setName] = useState("");
  const [walletValue, setWalletValue] = useState(walletAddress ?? "");
  const [rating, setRating] = useState("5");
  const [comment, setComment] = useState("");
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    setWalletValue(walletAddress ?? "");
  }, [walletAddress]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    feedbackSubmissions.push({
      name,
      walletAddress: walletValue,
      rating: Number(rating),
      comment,
      submittedAt: new Date().toISOString(),
    });

    setSubmitted(true);
    setName("");
    setComment("");
  }

  if (submitted) {
    return (
      <section className="feedback-form feedback-form-submitted">
        <h2>Feedback</h2>
        <p>Thank you for the feedback.</p>
      </section>
    );
  }

  return (
    <section className="feedback-form">
      <h2>Feedback</h2>
      <form className="feedback-fields" onSubmit={handleSubmit}>
        <label className="feedback-field">
          <span>Name</span>
          <input value={name} onChange={(event) => setName(event.target.value)} required />
        </label>
        <label className="feedback-field">
          <span>Wallet address</span>
          <input value={walletValue} readOnly required />
        </label>
        <label className="feedback-field">
          <span>Rating</span>
          <select value={rating} onChange={(event) => setRating(event.target.value)}>
            <option value="5">5</option>
            <option value="4">4</option>
            <option value="3">3</option>
            <option value="2">2</option>
            <option value="1">1</option>
          </select>
        </label>
        <label className="feedback-field">
          <span>Comment</span>
          <textarea value={comment} onChange={(event) => setComment(event.target.value)} required />
        </label>
        <button className="feedback-submit-button" type="submit" disabled={!walletValue}>
          Submit feedback
        </button>
      </form>
    </section>
  );
}

export function getFeedbackSubmissions(): FeedbackSubmission[] {
  return [...feedbackSubmissions];
}
