[link](https://cn.vitejs.dev/guide/api-plugin.html)

# API

## 插件 API

Vite 插件扩展了设计出色的 Rollup 接口，带有一些 Vite 独有的配置项。因此，你只需要编写一个 Vite 插件，就可以同时为开发环境和生产环境工作。

推荐在阅读下面的章节之前，首先阅读下 [Rollup 插件文档](https://rollupjs.org/guide/en/#plugin-development)。

### 1. 约定

如果插件不使用 Vite 特有的钩子，可以实现为 兼容的 Rollup 插件，推荐使用 Rollup 插件名称约定。

- Rollup 插件应用带有一个带 `rollup-plugin-` 前缀，语义清晰的名称。

- 在 `package.json` 中包含 `rollup-plugin` 和 `vite-plugin`关键字。

这样，插件也可以用于纯 Rollup 基于 WMR 的项目。

对于 Vite 专属的插件：

- Vite 插件应该有一个带 `vite-plugin-` 前缀，语义清晰的名称。

- 在 `package.json`中包含 `vite-plugin`关键字。

- 在插件文档增加一部分关于为什么本插件是一个 Vite 专属插件的详细说明（如，本插件使用了 Vite 特有的插件钩子）。

如果你的插件只适用于特定的框架，它的名字应该遵循以下前缀格式：

- `vite-plugin-vue-` 前缀作为 Vue 插件。

- `vite-plugin-react-` 前缀作为 React 插件。

- `vite-plugin-svelte-` 前缀作为 Svelte 插件。

### 2. 插件配置

用户会将插件添加到项目的 `devDependencies`中并使用数组形式的 `plugins`选项配置它们。

```js
// vite.config.js
import vitePlugin from 'vite-plugin-feature';
import rollupPlugin from 'rollup-plugin-feature';

export default defineConfig({
    plugins: [vitePlugin(), rollupPlugin()]
});
```

假值的插件将被忽略，可以用来轻松地启用或停用插件。

`plugins` 也可以接受将多个插件作为单个元素的预设。这对于使用多个插件实现的复杂特性（如框架集成）很有用。该数组将在内部被扁平化（flatten）。

```js
// 框架插件
import frameworkRefresh from 'vite-plugin-framework-refresh';
import frameworkDevtools from 'vite-plugin-framework-devtools';

export default function framework(config) {
    return [frameworkRefresh(config), frameworkDevtools(config)];
}

// vite.config.js
import { defineConfig } from 'vite';
import framework from 'vite-plugin-framework';

export default defineConfig({
    plugins: [framework()]
});
```

### 3. 简单示例

> **TIP**
>
> 通常的惯例是创建一个 Vite/Rollup 插件作为一个返回实际插件对象的工厂函数。该函数可以接受允许用户定义插件行为的选项。

#### a. 引入一个虚拟文件

```js
export default function myPlugin() {
    const virtualFileId = '@my-virtual-file';

    return {
        name: 'my-plugin', // 必须的，将会在 warning 和 error 中显示
        resolveId(id) {
            if(id === virtualFileId) {
                return virtualFileId;
            }
        },
        load(id) {
            if(id === virtualFileId) {
                return 'export const msg = "from virtual file"';
            }
        }
    };
}
```

这使得可以在 JavaScript 中引入这些文件：

```js
import { msg } from '@my-virtual-file';

console.log(msg);
```

#### b. 转换自定义文件类型

```js
const fileRegex = /\.(my-file-ext)$/;

export default function myPlugin() {
    return {
        name: 'transform-file',
        transform(src, id) {
            if(fileRegex.test(id)) {
                return {
                    code: compileFileToJS(src),
                    map: null // 如果可以将提供 source map
                };
            }
        }
    };
}
```

### 4. 通用钩子

在开发中，Vite 开发服务器会创建一个插件容器来调用 Rollup 构建钩子，与 Rollup 如出一辙。

以下钩子在服务器启动时被调用：

- `options`

- `buildStart`

以下钩子会在每个传入模块请求时被调用：

- `resolveId`

- `load`

- `transform`

以下钩子在服务器关闭时被调用：

- `buildEnd`

- `closeBundle`

请注意 `moduleParsed`钩子在开发中是不会被调用的，因为 Vite 为了性能会避免完整的 AST 解析。

Output Generation Hooks （除了 `closeBundle`）在开发中是不会被调用的。你可以认为 Vite 的开发服务器只调用了 `rollup.rollup()`而没有调用 `bundle.generate()`。

### 5. Vite 独有钩子

Vite 插件也可以提供钩子来服务于特定的 Vite 目标。这些钩子会被 Rollup 忽略。

#### `config`

- **类型**：`(config: UserConfig, env: {mode: string, command: string}) => UserConfig | null | void`

- **种类**：`async, sequential`

    在解析 Vite 配置前调用，钩子接收原始用户配置（命令行选项指定的会与配置文件合并）和一个描述配置环境的变量，包含正在使用的 `mode`和 `command`。它可以返回一个将被深度合并到现有配置中的部分配置对象，或者直接改变配置（如果默认的合并并不能达到预期的效果）。

    示例：

    ```js
    // 返回部分配置（推荐）
    const partialConfigPlugin = () => ({
        name: 'return-partial',
        config: () => ({
            alias: {
                foo: 'bar'
            }
        })
    });

    // 直接改变配置（应仅在合并并不起作用时使用）
    const mutateConfigPlugin = () => ({
        name: 'mutate-config',
        config(config, { command }) {
            if(command === 'build') {
                config.root = __dirname;
            }
        }
    });
    ```

    > 注意
    >
    > 用户插件在运行这个钩子之前会被解析，因此在 `config`钩子中注入其他插件不会有任何效果。

#### `configResolved`

- **类型**：`(config: ResolvedConfig) => void | Promise<void>`

- **种类**：`async, parallel`

    在解析 Vite 配置后调用。使用这个钩子读取和存储最终解析的配置。当插件需要根据运行的命令做一些不同的事情时，它也很有用。

    示例：

    ```js
    const examplePlugin = () => {
        let config;

        return {
            name: 'read-config',
            configResolved(resolvedConfig) {
                // 存储最终解析的配置
                config = resolvedConfig;
            },
            // 在其他钩子中使用存储的配置
            transform(code, id) {
                if(config.command === 'server') {
                    // server: 由开发服务器调用的插件
                } else {
                    // build: 由 Rollup 调用的插件
                }
            }
        };
    };
    ```

#### `configureServer`

- **类型**：`(server: ViteDevServer) => (() => void) | void | Promise<(() => void) | void>`

- **种类**：`async, sequential`

- **此外请看**：ViteDevServer

    是用于配置开发服务器的钩子。最常见的用例是在内部 connect 应用程序中添加自定义中间件：

    ```js
    const myPlugin = () => ({
        name: 'configure-server',
        configureServer(server) {
            server.middlewares.use((req, res, next) => {
                // 自定义请求处理。。。
            });
        }
    });
    ```

    **注入后置中间件**

    `configureServer`钩子将在内部中间件被安装前调用，所以自定义的中间件将会默认会比内部中间件早运行。如果你想注入一个在内部中间件之后运行的中间件，你可以从 `configureServer`返回一个函数，将会在内部中间件安装后被调用：

    ```js
    const myPlugin = () => ({
        name: 'configure-server',
        configureServer(server) {
            // 返回一个在内部中间件安装后
            // 被调用的后置钩子
            return () => {
                server.middlewares.use((req, res, next) => {
                    // 自定义请求处理。。。
                });
            };
        }
    });
    ```

    **存储服务器访问**

    在某些情况下，其他插件钩子可能需要访问开发服务器实例（例如访问 websocket 服务器，文件系统监视程序或模块图）。这个钩子也可以用来存储服务器实例以供其他钩子访问：

    ```js
    const myPlugin = () => {
        let server;
        return {
            name: 'configure-server',
            configureServer(_server) {
                server = _server;
            },
            transform(code, id) {
                if(server) {
                    // 使用 server...
                }
            }
        };
    };
    ```

    注意 `configureServer`在运行生产版本时不会被调用，所以其他钩子需要防范它缺失。

#### `transformIndexHtml`

#### `handleHotUpdate`

### 6. 