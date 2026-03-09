export const NumberAdder = () => {
    return (
        <div hx-ext="sse" sse-connect="/sse" sse-swap="time-update" hx-swap="beforeend">
            <h1>Number Adder</h1>
        </div>
      );
}
