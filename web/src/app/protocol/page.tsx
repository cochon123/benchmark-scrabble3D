export default function ProtocolPage() {
  return (
    <div className="standard-page protocol-page">
      <header className="page-heading"><p className="eyebrow">BENCHMARK CONTRACT</p><h1>Nothing up<br />the model’s sleeve.</h1><p>The test measures generation, not recognition. The model never sees a candidate list or solver trace.</p></header>
      <section className="protocol-flow">
        <article><span>01 / INPUT</span><h2>Board + rack</h2><p>Fifteen Z-layers encode the occupied cubes. Coordinates, rack letters, premium rules, and output schema are explicit.</p><code>15 × [15 rows × 15 columns]</code></article>
        <b>→</b>
        <article><span>02 / MODEL</span><h2>One answer</h2><p>The model returns only new `(x,y,z,letter)` placements in a strict JSON tool envelope.</p><code>play_move_3d</code></article>
        <b>→</b>
        <article><span>03 / VERIFIER</span><h2>Exact score</h2><p>The validator checks rack supply, collinearity, connection, every cross-word, premiums, and the solver optimum.</p><code>legal ∧ score = optimum</code></article>
      </section>
      <section className="rule-grid">
        <div className="rule-title"><span>THE LATTICE</span><h2>Spatial rules,<br />frozen.</h2></div>
        {[
          ["01", "CENTER", "The opening word crosses cube (7,7,7)."],
          ["02", "AXIS", "New cubes lie on exactly one of X, Y, or Z."],
          ["03", "CROSSES", "Each placed cube may form two perpendicular words."],
          ["04", "PREMIUMS", "A premium cube scores only on first occupation."],
          ["05", "BINGO", "Seven new cubes earn a 50-point bonus."],
          ["06", "TARGET", "Only legal exact-optimal single moves count."],
        ].map(([n, title, copy]) => <article key={n}><span>{n}</span><h3>{title}</h3><p>{copy}</p></article>)}
      </section>
      <section className="json-contract"><div><p className="eyebrow">OUTPUT CONTRACT</p><h2>Machine-checkable<br />by construction.</h2></div><pre>{`{
  "tool": "play_move_3d",
  "arguments": {
    "placements": [
      { "x": 2, "y": 3, "z": 4, "letter": "A" }
    ]
  }
}`}</pre></section>
    </div>
  );
}
