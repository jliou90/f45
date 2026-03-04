import { Component, type ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { addOpsError } from "../core/ops";

type Props = {
  children: ReactNode;
};

type BoundaryProps = Props & {
  onGoHome: () => void;
  onReload: () => void;
};

type State = {
  hasError: boolean;
  message: string;
};

class ShellErrorBoundaryImpl extends Component<BoundaryProps, State> {
  state: State = {
    hasError: false,
    message: "",
  };

  static getDerivedStateFromError(error: unknown): State {
    return {
      hasError: true,
      message: error instanceof Error ? error.message : String(error),
    };
  }

  componentDidCatch(error: unknown): void {
    addOpsError({
      type: "react-error-boundary",
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="panel error">
          <h1>Module failed to render</h1>
          <p className="muted">{this.state.message}</p>
          <div className="row">
            <button type="button" onClick={this.props.onGoHome}>
              Go Home
            </button>
            <button type="button" onClick={this.props.onReload}>
              Reload Module
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export function ShellErrorBoundary({ children }: Props) {
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <ShellErrorBoundaryImpl
      onGoHome={() => navigate("/app")}
      onReload={() => {
        window.location.assign(location.pathname);
      }}
    >
      {children}
    </ShellErrorBoundaryImpl>
  );
}
