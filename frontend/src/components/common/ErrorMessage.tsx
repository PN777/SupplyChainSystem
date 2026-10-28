type Props = { message: string }

export function ErrorMessage({ message }: Props) {
  return (
    <div className="rounded-lg border border-red-300/40 bg-red-500/10 px-4 py-3 text-sm text-red-500">
      {message}
    </div>
  )
}
