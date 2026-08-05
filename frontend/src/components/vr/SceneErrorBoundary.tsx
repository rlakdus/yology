import { Component, type ErrorInfo, type ReactNode } from "react";

interface SceneErrorBoundaryProps {
  children: ReactNode;
  onError?: (message: string) => void;
}

interface SceneErrorBoundaryState {
  failed: boolean;
}

/**
 * 씬에서 던져진 예외를 붙잡는다.
 *
 * 텍스처 로더는 파일을 못 읽으면 Suspense가 아니라 예외를 던진다. 경계가 없으면
 * React 트리 전체가 언마운트되어 화면이 통째로 하얗게 비고, 원인도 드러나지 않는다.
 * 자산 하나가 잘못돼도 무엇이 잘못됐는지는 보이게 한다.
 */
class SceneErrorBoundary extends Component<SceneErrorBoundaryProps, SceneErrorBoundaryState> {
  state: SceneErrorBoundaryState = { failed: false };

  static getDerivedStateFromError(): SceneErrorBoundaryState {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("VR 씬을 그리지 못했습니다.", error, info.componentStack);
    this.props.onError?.(error.message);
  }

  render() {
    return this.state.failed ? null : this.props.children;
  }
}

export default SceneErrorBoundary;
