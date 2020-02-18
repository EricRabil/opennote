module.exports = {
    css: {
      loaderOptions: {
        sass: {
          prependData: `
            @import "@/assets/colors.scss";
          `
        }
      }
    },
    parallel: true,
    chainWebpack: config => {
      config.module.rules.delete('eslint');
    }
  };