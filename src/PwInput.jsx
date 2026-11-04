import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";

// Password input with a show / hide eye button
export default function PwInput(props) {
  const [show, setShow] = useState(false);
  return (
    <span className="pwin">
      <input {...props} type={show ? "text" : "password"} />
      <button type="button" tabIndex={-1} aria-label={show ? "Hide password" : "Show password"} onClick={() => setShow(s => !s)}>
        {show ? <EyeOff size={18} /> : <Eye size={18} />}
      </button>
    </span>
  );
}
