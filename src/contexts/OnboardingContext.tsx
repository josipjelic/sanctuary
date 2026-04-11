import {
  checkOnboardingComplete,
  markOnboardingComplete,
} from "@/lib/oceanOnboarding";
import {
  type ReactNode,
  createContext,
  useCallback,
  useContext,
  useState,
} from "react";

type OnboardingContextValue = {
  onboardingChecked: boolean;
  onboardingComplete: boolean;
  markComplete: (userId: string) => Promise<void>;
  setCheckedState: (checked: boolean, complete: boolean) => void;
};

const OnboardingContext = createContext<OnboardingContextValue | null>(null);

export function OnboardingProvider({ children }: { children: ReactNode }) {
  const [onboardingChecked, setOnboardingChecked] = useState(false);
  const [onboardingComplete, setOnboardingComplete] = useState(false);

  function setCheckedState(checked: boolean, complete: boolean) {
    setOnboardingChecked(checked);
    setOnboardingComplete(complete);
  }

  const markComplete = useCallback(async (userId: string) => {
    await markOnboardingComplete(userId);
    setOnboardingComplete(true);
  }, []);

  return (
    <OnboardingContext.Provider
      value={{
        onboardingChecked,
        onboardingComplete,
        markComplete,
        setCheckedState,
      }}
    >
      {children}
    </OnboardingContext.Provider>
  );
}

export function useOnboardingContext(): OnboardingContextValue {
  const ctx = useContext(OnboardingContext);
  if (!ctx)
    throw new Error(
      "useOnboardingContext must be used within OnboardingProvider",
    );
  return ctx;
}

export { checkOnboardingComplete };
