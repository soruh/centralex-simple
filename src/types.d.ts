declare class NominalType<T extends string> {
    private as: T;
}

type Port = number & NominalType<"Port">;
type CallNumber = number & NominalType<"CallNumber">;
