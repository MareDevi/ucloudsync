/** @jsxImportSource hono/jsx */
import type { Child } from "hono/jsx";

export const Layout = ({
	title,
	children,
}: {
	title: string;
	children: Child;
}) => (
	<html lang="en">
		<head>
			<meta charset="UTF-8" />
			<meta name="viewport" content="width=device-width, initial-scale=1.0" />
			<title>{title} | UCloud Sync</title>
			<style>{`
      :root {
        --bg: #0f1115; --fg: #e1e4e8; --accent: #ff6b6b; --muted: #4b5563;
        --card-bg: #1a1d23; --success: #4ade80; --font: 'JetBrains Mono', monospace;
      }
      * { box-sizing: border-box; }
      body {
        background: var(--bg); color: var(--fg); font-family: var(--font);
        display: flex; flex-direction: column; align-items: center; min-height: 100vh; margin: 0; padding: 20px;
      }
      .container { width: 100%; max-width: 500px; margin-top: 60px; }
      .card {
        background: var(--card-bg); border: 1px solid var(--muted); padding: 30px;
        box-shadow: 10px 10px 0px var(--muted); margin-bottom: 30px;
      }
      h1, h2 { text-transform: uppercase; letter-spacing: 2px; border-bottom: 2px solid var(--accent); padding-bottom: 10px; margin-top: 0; }
      .input-group { margin-bottom: 20px; }
      input {
        background: transparent; border: 1px solid var(--muted); color: var(--fg); padding: 12px;
        width: 100%; box-sizing: border-box; font-family: var(--font); outline: none;
      }
      input:focus { border-color: var(--accent); }
      .btn {
        background: transparent; color: var(--fg); border: 1px solid var(--fg); padding: 12px 24px;
        cursor: pointer; text-transform: uppercase; font-family: var(--font);
        letter-spacing: 1px; transition: all 0.2s; text-decoration: none; display: inline-block; text-align: center;
      }
      .btn:hover { background: var(--fg); color: var(--bg); }
      .btn.accent { border-color: var(--accent); color: var(--accent); }
      .btn.accent:hover { background: var(--accent); color: white; }
      .btn.full { width: 100%; }
      .status-row { display: flex; justify-content: space-between; align-items: center; margin-top: 20px; padding: 15px; border: 1px dashed var(--muted); }
      .desc { font-size: 0.8rem; color: var(--muted); margin-bottom: 5px; }
    `}</style>
		</head>
		<body>
			<div className="container">{children}</div>
		</body>
	</html>
);
