import { cn } from "@/lib/utils";

interface ThemeToggleIconProps {
  theme: "light" | "dark";
  className?: string;
}

export function ThemeToggleIcon({ theme, className }: ThemeToggleIconProps) {
  const isLight = theme === "light";

  return (
    <svg
      viewBox="0 0 1200 1200"
      className={cn(
        "size-5 shrink-0 [&_path]:fill-current",
        "transition-transform duration-300 ease-out",
        isLight && "rotate-180",
        className
      )}
      aria-hidden
    >
      <path d="m600.04 24.852c-113.77-0.015624-224.98 33.707-319.58 96.898-94.602 63.191-168.34 153.02-211.88 258.12-43.547 105.1-54.949 220.75-32.762 332.33 22.184 111.58 76.961 214.08 157.4 294.53s182.93 135.24 294.5 157.44c111.58 22.203 227.23 10.816 332.34-32.719 105.11-43.531 194.94-117.25 258.15-211.84 63.207-94.59 96.941-205.8 96.941-319.57-0.16406-152.48-60.809-298.68-168.62-406.51-107.82-107.83-254-168.49-406.48-168.68zm-535.99 575.19c0.16406-142.1 56.688-278.34 157.17-378.82 100.48-100.48 236.72-157 378.82-157.17v1071.9c-142.09-0.14453-278.33-56.648-378.81-157.12-100.48-100.47-157.01-236.7-157.18-378.79z" />
    </svg>
  );
}
