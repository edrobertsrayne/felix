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
  # Use Bun-based linting and formatting
  git-hooks.hooks = {
    pre-commit = {
      enable = true;
      name = "pre-commit";
      entry = "${pkgs.bun}/bin/bun test";
      files = "\\.ts$";
      language = "system";
      pass_filenames = false;
    };
    prettier = {
      enable = true;
      name = "prettier";
      entry = "${pkgs.bun}/bin/bunx prettier --check";
      files = "\\.ts$";
      language = "system";
      pass_filenames = true;
    };
    eslint = {
      enable = true;
      name = "eslint";
      entry = "${pkgs.bun}/bin/bunx eslint";
      files = "\\.ts$";
      language = "system";
      pass_filenames = true;
    };
  };

  # See full reference at https://devenv.sh/reference/options/
}
