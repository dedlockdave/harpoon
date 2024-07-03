export default function Loader({ text = "working" }) {
  return (
    <div className="text-white flex flex-col text-center items-center">
      <div className="lds-roller">
        <div></div>
        <div></div>
        <div></div>
        <div></div>
        <div></div>
        <div></div>
        <div></div>
        <div></div>
      </div>
      <span className="text-sm text-neutral">{text}</span>
    </div>
  );
}
