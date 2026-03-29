import { render } from "@testing-library/react-native";
import { Topic } from "./Topic";

describe("Topic", () => {
  it("renders the label text", () => {
    const { getByText } = render(<Topic label="work" />);
    expect(getByText("Work")).toBeTruthy();
  });

  it("exposes testID for E2E selectors", () => {
    const { getByTestId } = render(
      <Topic label="reflection" testID="topic-reflection" />,
    );
    expect(getByTestId("topic-reflection")).toBeTruthy();
  });
});
