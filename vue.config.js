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
    // publicPath: '/opennote/',
    parallel: true,
    chainWebpack: config => {
      config.module.rules.delete('eslint');

      // config.module.rule('ts').exclude.add(/\.worker.ts$/);

      config.module
        .rule('worker')
        .post()
        .test(/\.worker\.ts$/)
        .use('worker-loader')
          .loader('worker-loader')
          .end();
    }
  };