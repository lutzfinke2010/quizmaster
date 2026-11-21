import { QRCodeSVG } from "qrcode.react";
import { formatJoinCode } from "../../shareLinks";

/** QR code, address and join code for the shared screen. */
export function JoinDetails({ code }: { code: string }) {
  const origin = window.location.origin;
  return <div className="rl-live-join">
    <div className="rl-live-join-qr">
      <QRCodeSVG value={`${origin}/join/${code}`} size={176} bgColor="#ffffff" fgColor="#183a30" marginSize={1}
        title="QR-Code zum Beitreten" />
    </div>
    <div className="rl-live-join-text">
      <span className="rl-eyebrow">DEIN WEG IN DIE RUNDE</span>
      <p>Beitreten unter <strong>{origin}/join</strong></p>
      <strong className="rl-live-join-code" aria-label={`Spielcode ${code.split("").join(" ")}`}>{formatJoinCode(code)}</strong>
    </div>
  </div>;
}
