import { useCallback, useEffect, useRef, useState } from "react";

type RumbleEffect = {
  duration: number;
  startDelay: number;
  strongMagnitude: number;
  weakMagnitude: number;
};

type RumbleActuator = {
  playEffect?: (type: string, effect: RumbleEffect) => Promise<unknown>;
  reset?: () => Promise<unknown>;
};

type HapticGamepad = Gamepad & {
  vibrationActuator?: RumbleActuator;
  hapticActuators?: RumbleActuator[];
};

const gamepadActuators = () => {
  if (!navigator.getGamepads) return [];

  return Array.from(navigator.getGamepads())
    .filter((gamepad): gamepad is Gamepad => gamepad !== null)
    .flatMap((gamepad) => {
      const haptic = gamepad as HapticGamepad;
      if (haptic.vibrationActuator) return [haptic.vibrationActuator];
      return haptic.hapticActuators ?? [];
    })
    .filter((actuator) => typeof actuator.playEffect === "function");
};

const hasDeviceVibration = () => typeof navigator.vibrate === "function";

/**
 * 브라우저가 노출하는 모바일·컨트롤러 진동을 공통 심박 펄스로 감싼다.
 * 전용 흉부 장치는 이후 같은 pulse/stop 계약을 구현하는 어댑터로 교체한다.
 */
export const useHeartbeatHaptics = (enabled: boolean) => {
  const secondPulseRef = useRef<number | null>(null);
  const [available, setAvailable] = useState(() => hasDeviceVibration() || gamepadActuators().length > 0);

  const refreshAvailability = useCallback(() => {
    setAvailable(hasDeviceVibration() || gamepadActuators().length > 0);
  }, []);

  useEffect(() => {
    window.addEventListener("gamepadconnected", refreshAvailability);
    window.addEventListener("gamepaddisconnected", refreshAvailability);
    return () => {
      window.removeEventListener("gamepadconnected", refreshAvailability);
      window.removeEventListener("gamepaddisconnected", refreshAvailability);
    };
  }, [refreshAvailability]);

  const stop = useCallback(() => {
    if (secondPulseRef.current !== null) {
      window.clearTimeout(secondPulseRef.current);
      secondPulseRef.current = null;
    }
    if (hasDeviceVibration()) navigator.vibrate(0);
    for (const actuator of gamepadActuators()) void actuator.reset?.().catch(() => undefined);
  }, []);

  const pulse = useCallback((bpm: number) => {
    if (!enabled) return;

    const intervalMs = 60_000 / Math.max(35, Math.min(200, bpm));
    // 오디오 lub-dub의 두 번째 심음과 같은 상대 위치를 사용한다.
    const secondDelay = Math.min(300, intervalMs * 0.28);

    // 모바일 진동은 배열 하나로 lub-dub을 예약한다.
    if (hasDeviceVibration()) {
      navigator.vibrate([48, Math.max(35, secondDelay - 48), 30]);
    }

    const actuators = gamepadActuators();
    for (const actuator of actuators) {
      void actuator.playEffect?.("dual-rumble", {
        duration: 70,
        startDelay: 0,
        strongMagnitude: 0.72,
        weakMagnitude: 0.38,
      }).catch(() => undefined);
    }

    if (secondPulseRef.current !== null) window.clearTimeout(secondPulseRef.current);
    secondPulseRef.current = window.setTimeout(() => {
      for (const actuator of gamepadActuators()) {
        void actuator.playEffect?.("dual-rumble", {
          duration: 50,
          startDelay: 0,
          strongMagnitude: 0.35,
          weakMagnitude: 0.18,
        }).catch(() => undefined);
      }
      secondPulseRef.current = null;
    }, secondDelay);
  }, [enabled]);

  useEffect(() => stop, [stop]);

  return {
    available,
    label: available
      ? "진동 API 감지 · 실제 출력은 장치에 따라 다름"
      : "호환 진동 장치 없음 · 오디오로 계속",
    pulse,
    stop,
  };
};
