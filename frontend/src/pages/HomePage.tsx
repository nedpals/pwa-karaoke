import { Link } from "react-router";

export default function HomePage() {
  return (
    <div className="h-screen flex flex-row items-center justify-center gap-4">
      <Link to="/player">Go to Player</Link>
      <Link to="/controller">Go to Controller</Link>
    </div>
  );
}
