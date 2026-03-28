import { fireEvent, render } from "@testing-library/react-native";
import { TextInput } from "./TextInput";

describe("TextInput", () => {
  it("renders with placeholder text", () => {
    const { getByPlaceholderText } = render(
      <TextInput placeholder="What's on your mind?" />,
    );
    expect(getByPlaceholderText("What's on your mind?")).toBeTruthy();
  });

  it("calls onChangeText when text changes", () => {
    const onChangeText = jest.fn();
    const { getByPlaceholderText } = render(
      <TextInput placeholder="Write here" onChangeText={onChangeText} />,
    );
    fireEvent.changeText(getByPlaceholderText("Write here"), "new thought");
    expect(onChangeText).toHaveBeenCalledWith("new thought");
  });

  it("exposes testID for E2E selectors", () => {
    const { getByTestId } = render(<TextInput testID="thought-input" />);
    expect(getByTestId("thought-input")).toBeTruthy();
  });

  it("handles focus and blur without error", () => {
    const { getByTestId } = render(<TextInput testID="focus-input" />);
    const input = getByTestId("focus-input");
    fireEvent(input, "focus");
    fireEvent(input, "blur");
  });
});
