export type CellState = 'done' | 'missed' | 'not-due' | 'future'

interface CompletionCellProps {
  state: CellState
  onClick: () => void
}

export function CompletionCell({ state, onClick }: CompletionCellProps) {
  return (
    <button
      className={`completion-cell completion-cell--${state}`}
      onClick={onClick}
      disabled={state === 'future' || state === 'not-due'}
      title={state === 'done' ? 'Réalisé' : state === 'missed' ? 'Manqué' : state === 'future' ? 'À venir' : ''}
    >
      {state === 'done' && '✓'}
      {state === 'missed' && '✗'}
    </button>
  )
}
