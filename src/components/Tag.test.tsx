import { render } from "@testing-library/react-native";
import { Tag } from "./Tag";

describe("Tag", () => {
  it("renders the label text", () => {
    const { getByText } = render(<Tag label="idea" />);
    expect(getByText("idea")).toBeTruthy();
  });

  it("exposes testID for E2E selectors", () => {
    const { getByTestId } = render(
      <Tag label="feeling" testID="tag-feeling" />,
    );
    expect(getByTestId("tag-feeling")).toBeTruthy();
  });
});
