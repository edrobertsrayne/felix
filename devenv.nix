{pkgs, ...}: {
  # https://devenv.sh/packages/
  packages = with pkgs; [
    git
    jq
    just
    bun
    chromium
    sqlite
  ];

  env.CHROMIUM_PATH = "${pkgs.chromium}/bin/chromium";

  dotenv.enable = true;

  # https://devenv.sh/languages/
  languages = {
    javascript = {
      enable = true;
      bun = {
        enable = true;
        install.enable = true;
      };
    };
  };

  # https://devenv.sh/git-hooks/
  # Use Bun-based linting and formatting (not Python prek)
  git-hooks.hooks = {
    prettier = {
      enable = true;
      name = "prettier";
      entry = "${pkgs.bun}/bin/bun run prettier --check";
      files = "\\.ts$";
      language = "system";
      pass_filenames = true;
    };
    eslint = {
      enable = true;
      name = "eslint";
      entry = "${pkgs.bun}/bin/bun run eslint";
      files = "\\.ts$";
      language = "system";
      pass_filenames = true;
    };
  };

  # See full reference at https://devenv.sh/reference/options/
}
