import { render } from "@testing-library/react-native";
import { Text } from "react-native";
import { Card } from "./Card";

describe("Card", () => {
  it("renders children", () => {
    const { getByText } = render(
      <Card>
        <Text>Hello</Text>
      </Card>,
    );
    expect(getByText("Hello")).toBeTruthy();
  });

  it("renders xl size without throwing", () => {
    const { getByTestId } = render(
      <Card size="xl" testID="card-xl">
        <Text>Content</Text>
      </Card>,
    );
    expect(getByTestId("card-xl")).toBeTruthy();
  });

  it("renders flat variant without throwing", () => {
    const { getByTestId } = render(
      <Card variant="flat" testID="card-flat">
        <Text>Content</Text>
      </Card>,
    );
    expect(getByTestId("card-flat")).toBeTruthy();
  });
});
