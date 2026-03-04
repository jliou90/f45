type BannerProps = {
  message: string;
};

export function Banner({ message }: BannerProps) {
  return <div className="banner">{message}</div>;
}
