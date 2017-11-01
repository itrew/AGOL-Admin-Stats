import babel from 'rollup-plugin-babel';
import eslint from 'rollup-plugin-eslint';
import resolve from 'rollup-plugin-node-resolve';
import commonjs from 'rollup-plugin-commonjs';
import replace from 'rollup-plugin-replace';
import uglify from 'rollup-plugin-uglify';
import serve from 'rollup-plugin-serve';
import livereload from 'rollup-plugin-livereload';

export default {
  name: 'AGOLAdminStats',
  input: 'src/index.js',
  output: {
    file: 'dist/build/index.js',
    format: 'iife',
  },
  sourcemap: true,
  plugins: [
    resolve({
      jsnext: true,
      main: true,
      browser: true,
    }),
    commonjs(),
    eslint(),
    babel({
      exclude: 'node_modules/**',
    }),
    replace({
      exclude: 'node_modules/**',
      ENV: `'${process.env.NODE_ENV}'` || 'development',
    }),
    (process.env.NODE_ENV === 'production' && uglify()),
    (process.env.NODE_ENV === 'development' && serve({
      open: true,
      contentBase: 'dist',
    })),
    (process.env.NODE_ENV === 'development' && livereload()),
  ],
};
