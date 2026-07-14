import Link from 'next/link';
import { CpuChipIcon, ShareIcon } from '@heroicons/react/24/outline';

interface ModeSwitchLinkProps {
  currentMode: 'cluster' | 'ann';
}

const ModeSwitchLink: React.FC<ModeSwitchLinkProps> = ({ currentMode }) => {
  const switchesToAnn = currentMode === 'cluster';
  const href = switchesToAnn ? '/ann' : '/';
  const label = switchesToAnn ? 'Switch to Neural Network mode' : 'Switch to Cluster mode';
  const Icon = switchesToAnn ? CpuChipIcon : ShareIcon;

  return (
    <Link
      href={href}
      aria-label={label}
      title={label}
      data-mode-switch-to={switchesToAnn ? 'ann' : 'cluster'}
      className="inline-flex h-8 w-8 flex-shrink-0 items-center justify-center border-0 bg-transparent text-[var(--accent-primary)] transition-colors hover:text-[var(--accent-secondary)] focus:outline-none focus-visible:outline focus-visible:outline-1 focus-visible:outline-[var(--accent-primary)]"
    >
      <Icon className="h-5 w-5" aria-hidden="true" />
    </Link>
  );
};

export default ModeSwitchLink;
