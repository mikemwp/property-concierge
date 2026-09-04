"use client";

type Props = {
  error: string | null;
};

export function ActionErrorBanner({ error }: Props) {
  if (!error) {
    return null;
  }

  return (
    <p
      role="alert"
      className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800"
    >
      {error}
    </p>
  );
}
