export function Rack({ letters }: { letters: string }) {
  return (
    <div className="rack" aria-label={`Rack ${letters.split("").join(" ")}`}>
      {letters.split("").map((letter, index) => <span key={`${letter}-${index}`}>{letter}<small>{letter === "?" ? 0 : ""}</small></span>)}
    </div>
  );
}
