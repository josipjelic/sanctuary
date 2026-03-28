import { fireEvent, render } from "@testing-library/react-native";
import { Button } from "./Button";

describe("Button", () => {
  it("renders the label", () => {
    const { getByText } = render(
      <Button label="Capture thought" onPress={() => {}} />,
    );
    expect(getByText("Capture thought")).toBeTruthy();
  });

  it("calls onPress when tapped", () => {
    const onPress = jest.fn();
    const { getByText } = render(<Button label="Save" onPress={onPress} />);
    fireEvent.press(getByText("Save"));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it("does not call onPress when disabled", () => {
    const onPress = jest.fn();
    const { getByText } = render(
      <Button label="Save" onPress={onPress} disabled />,
    );
    fireEvent.press(getByText("Save"));
    expect(onPress).not.toHaveBeenCalled();
  });

  it("renders the secondary variant without throwing", () => {
    const { getByText } = render(
      <Button label="Cancel" onPress={() => {}} variant="secondary" />,
    );
    expect(getByText("Cancel")).toBeTruthy();
  });

  it("exposes testID for E2E selectors", () => {
    const { getByTestId } = render(
      <Button label="Go" onPress={() => {}} testID="btn-go" />,
    );
    expect(getByTestId("btn-go")).toBeTruthy();
  });
});
