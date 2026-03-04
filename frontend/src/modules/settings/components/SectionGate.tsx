import type { ReactNode } from "react";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Badge, Modal } from "../../../ui";
import { useSettingsState } from "../layout/SettingsLayout";

type SectionGateRenderState = {
  canRead: boolean;
  canWrite: boolean;
  readOnly: boolean;
};

type SectionGateProps = {
  title?: string;
  readPerm: string;
  writePerm?: string;
  children: ReactNode | ((state: SectionGateRenderState) => ReactNode);
};

function disabledReason(requiredPermission: string): string {
  return `This action requires "${requiredPermission}".`;
}

export function SectionGate({ title, readPerm, writePerm, children }: SectionGateProps) {
  const { access } = useSettingsState();
  const [whyOpen, setWhyOpen] = useState(false);

  const canRead = access.hasPermission(readPerm);
  const canWrite = writePerm ? access.hasPermission(writePerm) : true;
  const readOnly = canRead && !canWrite;

  const requiredWritePermission = writePerm ?? readPerm;
  const adminInspectorLink = useMemo(
    () => `/admin/permissions?user=self&perm=${encodeURIComponent(requiredWritePermission)}`,
    [requiredWritePermission],
  );

  if (!canRead) {
    return (
      <div className="panel stack">
        <h3>{title ?? "Not authorized"}</h3>
        <p className="muted">Not authorized to view this section.</p>
        <p className="muted">Required permission: <code>{readPerm}</code></p>
      </div>
    );
  }

  return (
    <div className="stack">
      {readOnly ? (
        <div className="row">
          <Badge tone="warn">Read-only</Badge>
          {access.hasAdminInspectorAccess ? (
            <Link className="linkButton" to={adminInspectorLink}>Why is this disabled?</Link>
          ) : (
            <button type="button" className="linkButton" onClick={() => setWhyOpen(true)}>Why is this disabled?</button>
          )}
        </div>
      ) : null}

      <fieldset disabled={readOnly} style={{ border: "none", margin: 0, padding: 0 }}>
        {typeof children === "function"
          ? (children as (state: SectionGateRenderState) => ReactNode)({ canRead, canWrite, readOnly })
          : children}
      </fieldset>

      <Modal open={whyOpen} title="Why this is read-only" onClose={() => setWhyOpen(false)}>
        <p className="muted">{disabledReason(requiredWritePermission)}</p>
        <p className="muted">Your account can view this section but cannot edit it.</p>
      </Modal>
    </div>
  );
}
