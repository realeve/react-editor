import * as React from "react";
import InfiniteViewer, { OnScroll } from "react-infinite-viewer";
import Guides from "@scena/react-guides";
import Selecto, { OnDragEvent } from "react-selecto";
import "./Editor.css";
import Viewport, {
  ElementInfo,
  MovedInfo,
  MovedResult,
} from "./Viewport/Viewport";
import { prefix, getIds, checkImageLoaded, getScenaAttrs } from "./utils/utils";

import EventBus from "./utils/EventBus";
import { IObject } from "@daybrush/utils";
import Memory from "./utils/Memory";
import MoveableManager from "./Viewport/MoveableMananger";
import MoveableData from "./utils/MoveableData";
import KeyManager from "./KeyManager/KeyManager";
import {
  ScenaEditorState,
  SavedScenaData,
  ScenaJSXElement,
  ScenaJSXType,
} from "./types";
import HistoryManager from "./utils/HistoryManager";
import Debugger from "./utils/Debugger";
import { isMacintosh, DATA_SCENA_ELEMENT_ID } from "./consts";
import ClipboardManager from "./utils/ClipboardManager";
import { generateId } from "./utils/utils";
import classnames from "classnames";

const getDefaultStyle = (style?: React.CSSProperties) => {
  const rect = {
    top: 80,
    left: 80,
    width: 320,
    height: 180,
    ...style,
  };

  return {
    top: `${rect.top}px`,
    left: `${rect.left}px`,
    position: "absolute",
    width: `${rect.width}px`,
    height: `${rect.height}px`,
    background: "#4af",
  } as React.CSSProperties;
};

function undoCreateElements(
  { infos, prevSelected }: IObject<any>,
  editor: Editor
) {
  const res = editor.removeByIds(
    infos.map((info: ElementInfo) => info.id),
    true
  );

  if (prevSelected) {
    res.then(() => {
      editor.setSelectedTargets(
        editor.getViewport().getElements(prevSelected),
        true
      );
    });
  }
}
function restoreElements({ infos }: IObject<any>, editor: Editor) {
  editor.appendJSXs(
    infos.map((info: ElementInfo) => ({
      ...info,
    })),
    true
  );
}
function undoSelectTargets({ prevs, nexts }: IObject<any>, editor: Editor) {
  editor.setSelectedTargets(editor.viewport.current!.getElements(prevs), true);
}
function redoSelectTargets({ prevs, nexts }: IObject<any>, editor: Editor) {
  editor.setSelectedTargets(editor.viewport.current!.getElements(nexts), true);
}
function undoChangeText({ prev, next, id }: IObject<any>, editor: Editor) {
  const info = editor.getViewport().getInfo(id)!;
  info.innerText = prev;
  info.el!.innerText = prev;
}
function redoChangeText({ prev, next, id }: IObject<any>, editor: Editor) {
  const info = editor.getViewport().getInfo(id)!;
  info.innerText = next;
  info.el!.innerText = next;
}
function undoMove({ prevInfos }: MovedResult, editor: Editor) {
  editor.moves(prevInfos, true);
}
function redoMove({ nextInfos }: MovedResult, editor: Editor) {
  editor.moves(nextInfos, true);
}

const range = { padding: 100, width: 1920, height: 1200 };
const rangeX = [-range.padding, range.width / 3 + range.padding],
  rangeY = [-range.padding, range.height / 3 + range.padding];

export interface IEditorProps {
  width: number;
  height: number;
  debug?: boolean;
  style?: React.CSSProperties;

  // 选中元素
  onSelect?: (name: string[]) => void;

  // 移除元素
  onRemove?: (name: string[]) => void;

  // 属性变更
  onChange?: (name: { id: string; next: {} }[]) => void;
}

class Editor extends React.PureComponent<
  IEditorProps,
  Partial<ScenaEditorState>
> {
  public static defaultProps = {
    width: 1920,
    height: 1080,
  };
  public state: ScenaEditorState = {
    selectedTargets: [],
    horizontalGuides: [],
    verticalGuides: [],
    zoom: 1,
    selectedMenu: "MoveTool",
    canvas: {
      x: 0,
      y: 0,
    },
  };
  public historyManager = new HistoryManager(this);
  public console = new Debugger(this.props.debug);
  public eventBus = new EventBus();
  public memory = new Memory();
  public moveableData = new MoveableData(this.memory);
  public keyManager = new KeyManager(this.console);
  public clipboardManager = new ClipboardManager(this);

  public horizontalGuides = React.createRef<Guides>();
  public verticalGuides = React.createRef<Guides>();
  public infiniteViewer = React.createRef<InfiniteViewer>();
  public selecto = React.createRef<Selecto>();
  public moveableManager = React.createRef<MoveableManager>();
  public viewport = React.createRef<Viewport>();

  public editorElement = React.createRef<HTMLDivElement>();

  public render() {
    const {
      horizontalGuides,
      verticalGuides,
      infiniteViewer,
      moveableManager,
      viewport,
      selecto,
      state,
    } = this;
    const { selectedMenu, selectedTargets, zoom } = state;
    const { width, height } = this.props;
    const horizontalSnapGuides = [
      0,
      height,
      height / 2,
      ...state.horizontalGuides,
    ];
    const verticalSnapGuides = [0, width, width / 2, ...state.verticalGuides];
    let unit = 50;

    if (zoom < 0.8) {
      unit = Math.floor(1 / zoom) * 50;
    }
    return (
      <div
        className={classnames(prefix("editor"), {
          [prefix("hand")]: selectedMenu === "hand",
        })}
        style={this.props.style}
        ref={this.editorElement}
      >
        <div
          className={prefix("reset")}
          onClick={(e) => {
            infiniteViewer.current!.scrollCenter();
          }}
        ></div>
        <Guides
          ref={horizontalGuides}
          type="horizontal"
          className={prefix("guides", "horizontal")}
          style={{}}
          snapThreshold={5}
          snaps={horizontalSnapGuides}
          displayDragPos={true}
          dragPosFormat={(v) => `${v}px`}
          zoom={zoom}
          unit={unit}
          onChangeGuides={(e) => {
            this.setState({
              horizontalGuides: e.guides,
            });
          }}
        ></Guides>
        <Guides
          ref={verticalGuides}
          type="vertical"
          className={prefix("guides", "vertical")}
          style={{}}
          snapThreshold={5}
          snaps={verticalSnapGuides}
          displayDragPos={true}
          dragPosFormat={(v) => `${v}px`}
          zoom={zoom}
          unit={unit}
          onChangeGuides={(e) => {
            this.setState({
              verticalGuides: e.guides,
            });
          }}
        ></Guides>
        <InfiniteViewer
          ref={infiniteViewer}
          className={prefix("viewer")}
          usePinch={true}
          pinchThreshold={50}
          zoom={zoom} 
          rangeX={rangeX}
          rangeY={rangeY}
          onAbortPinch={(e) => {
            selecto.current!.triggerDragStart(e.inputEvent);
          }}
          onScroll={(e: OnScroll) => {
            let x =
                e.scrollLeft < rangeX[0]
                  ? -1
                  : e.scrollLeft < rangeX[1]
                  ? 0
                  : 1,
              y =
                e.scrollTop < rangeY[0] ? -1 : e.scrollTop < rangeY[1] ? 0 : 1;

            this.setState({
              canvas: { x, y },
            });

            !x && horizontalGuides.current!.scroll(e.scrollLeft);
            horizontalGuides.current!.scrollGuides(e.scrollTop);

            !y && verticalGuides.current!.scroll(e.scrollTop);
            verticalGuides.current!.scrollGuides(e.scrollLeft);
          }}
          onPinch={(e) => {
            this.setState({
              zoom: e.zoom,
            });
          }}
        >
          <Viewport
            ref={viewport}
            style={{
              width: `${width}px`,
              height: `${height}px`,
              position: "absolute",
              left: 100,
              top: 100,
            }}
          >
            <MoveableManager
              ref={moveableManager}
              selectedTargets={selectedTargets}
              verticalGuidelines={verticalSnapGuides}
              horizontalGuidelines={horizontalSnapGuides}
              editor={this}
              onChange={this.props.onChange}
            ></MoveableManager>
          </Viewport>
        </InfiniteViewer>
        <Selecto
          ref={selecto}
          dragContainer={`.scena-viewer`}
          hitRate={0}
          selectableTargets={[`.scena-viewport [${DATA_SCENA_ELEMENT_ID}]`]}
          selectByClick={selectedMenu !== "hand"}
          selectFromInside={false}
          toggleContinueSelect={["shift"]}
          preventDefault={true}
          scrollOptions={
            infiniteViewer.current
              ? {
                  container: infiniteViewer.current.getContainer(),
                  threshold: 30,
                  throttleTime: 30,
                  getScrollPosition: () => {
                    const current = infiniteViewer.current!;
                    return [current.getScrollLeft(), current.getScrollTop()];
                  },
                }
              : undefined
          }
          onDragStart={(e) => {
            if (selectedMenu === "hand") {
              return;
            }
            const inputEvent = e.inputEvent;
            const target = inputEvent.target;
            this.checkBlur();

            if (
              (inputEvent.type === "touchstart" && e.isTrusted) ||
              moveableManager
                .current!.getMoveable()
                .isMoveableElement(target) ||
              state.selectedTargets.some(
                (t) => t === target || t.contains(target)
              )
            ) {
              e.stop();
            }
          }}
          onDrag={(e: { deltaX: number; deltaY: number }) => {
            if (selectedMenu === "MoveTool") {
              return;
            }
            let { x, y } = this.state.canvas;
            infiniteViewer.current!.scrollBy(
              x === 0 || x * e.deltaX > 0 ? -e.deltaX : 0,
              y === 0 || y * e.deltaY > 0 ? -e.deltaY : 0
            );
          }}
          onSelectEnd={({ isDragStart, selected, inputEvent }) => {
            if (selectedMenu === "hand") {
              return;
            }

            if (isDragStart) {
              inputEvent.preventDefault();
            }

            this.setSelectedTargets(selected).then(() => {
              if (!isDragStart) {
                return;
              }
              moveableManager.current!.getMoveable().dragStart(inputEvent);
            });
          }}
        ></Selecto>
      </div>
    );
  }
  public componentDidMount() {
    const { infiniteViewer, memory, eventBus } = this;
    memory.set("background-color", "#4af");

    requestAnimationFrame(() => {
      infiniteViewer.current!.scrollCenter();
    });
    window.addEventListener("resize", this.onResize);
    const viewport = this.getViewport();

    eventBus.on("selectLayers", (e: any) => {
      const selected = e.selected as string[];

      this.setSelectedTargets(
        selected.map((key) => viewport.getInfo(key)!.el!)
      );
    });
    eventBus.on("update", () => {
      this.forceUpdate();
    });

    const handleSelectMode = (selectedMenu: "MoveTool" | "hand") => {
      this.setState({
        selectedMenu,
      });
    };

    this.keyManager.keydown(
      ["h"],
      (e) => {
        handleSelectMode("hand");
      },
      "移动工具：移动屏幕位置"
    );

    this.keyManager.keydown(
      ["v"],
      (e) => {
        handleSelectMode("MoveTool");
      },
      "选择工具：选择屏幕中的组件"
    );

    this.keyManager.keydown(
      ["left"],
      (e) => {
        this.move(-10, 0);
        e.inputEvent.preventDefault();
      },
      "向左移动"
    );
    this.keyManager.keydown(
      ["up"],
      (e) => {
        this.move(0, -10);
        e.inputEvent.preventDefault();
      },
      "向上移动"
    );
    this.keyManager.keydown(
      ["right"],
      (e) => {
        this.move(10, 0);
        e.inputEvent.preventDefault();
      },
      "向右移动"
    );
    this.keyManager.keydown(
      ["down"],
      (e) => {
        this.move(0, 10);
        e.inputEvent.preventDefault();
      },
      "向下移动"
    );
    this.keyManager.keyup(
      ["backspace"],
      () => {
        let targets = this.getSelectedTargets();
        const ids = getIds(targets);
        this.props.onRemove?.(ids);
        this.removeElements(targets);
      },
      "删除"
    );
    this.keyManager.keyup(
      ["delete"],
      () => {
        let targets = this.getSelectedTargets();
        const ids = getIds(targets);
        this.props.onRemove?.(ids);
        this.removeElements(targets);
      },
      "删除"
    );
    this.keyManager.keydown(
      [isMacintosh ? "meta" : "ctrl", "x"],
      () => {},
      "剪切"
    );
    this.keyManager.keydown(
      [isMacintosh ? "meta" : "ctrl", "c"],
      () => {},
      "复制"
    );
    this.keyManager.keydown(
      [isMacintosh ? "meta" : "ctrl", "shift", "c"],
      (e) => {
        this.clipboardManager.copyImage();
        e.inputEvent.preventDefault();
      },
      "复制为图像"
    );
    this.keyManager.keydown(
      [isMacintosh ? "meta" : "ctrl", "v"],
      () => {},
      "粘贴"
    );
    this.keyManager.keydown(
      [isMacintosh ? "meta" : "ctrl", "z"],
      () => {
        this.historyManager.undo();
      },
      "撤销"
    );
    this.keyManager.keydown(
      [isMacintosh ? "meta" : "ctrl", "shift", "z"],
      () => {
        this.historyManager.redo();
      },
      "重做"
    );
    this.keyManager.keydown(
      [isMacintosh ? "meta" : "ctrl", "a"],
      (e) => {
        this.setSelectedTargets(
          this.getViewportInfos().map((info) => info.el!)
        );
        e.inputEvent.preventDefault();
      },
      "全选"
    );

    this.historyManager.registerType(
      "createElements",
      undoCreateElements,
      restoreElements
    );
    this.historyManager.registerType(
      "removeElements",
      restoreElements,
      undoCreateElements
    );
    this.historyManager.registerType(
      "selectTargets",
      undoSelectTargets,
      redoSelectTargets
    );
    this.historyManager.registerType(
      "changeText",
      undoChangeText,
      redoChangeText
    );
    this.historyManager.registerType("move", undoMove, redoMove);
  }
  public componentWillUnmount() {
    this.eventBus.off();
    this.memory.clear();
    this.moveableData.clear();
    this.keyManager.destroy();
    this.clipboardManager.destroy();
    window.removeEventListener("resize", this.onResize);
  }
  public promiseState(state: Partial<ScenaEditorState>) {
    return new Promise((resolve) => {
      this.setState(state, () => {
        resolve();
      });
    });
  }
  public getSelectedTargets() {
    return this.state.selectedTargets;
  }
  public setSelectedTargets(
    targets: Array<HTMLElement | SVGElement>,
    isRestore?: boolean
  ) {
    targets = targets.filter((target) => {
      return targets.every((parnetTarget) => {
        return parnetTarget === target || !parnetTarget.contains(target);
      });
    });

    return this.promiseState({
      selectedTargets: targets,
    }).then(() => {
      if (!isRestore) {
        const prevs = getIds(this.moveableData.getSelectedTargets());
        const nexts = getIds(targets);

        if (
          prevs.length !== nexts.length ||
          !prevs.every((prev, i) => nexts[i] === prev)
        ) {
          // 被选中
          this.props?.onSelect?.(nexts);
          this.historyManager.addAction("selectTargets", {
            prevs,
            nexts,
          });
        }
      }
      this.selecto.current!.setSelectedTargets(targets);
      this.moveableData.setSelectedTargets(targets);
      this.eventBus.trigger("setSelectedTargets");
      return targets;
    });
  }

  public appendJSX(info: ElementInfo) {
    return this.appendJSXs([info]).then((targets) => targets[0]);
  }
  public append(jsx: ScenaJSXType, name?: string) {
    name = name || generateId();
    return this.appendJSXs([
      {
        jsx,
        name,
        frame: getDefaultStyle(),
      },
    ]).then((targets) => targets[0]);
  }

  public appendJSXs(
    jsxs: ElementInfo[],
    isRestore?: boolean
  ): Promise<Array<HTMLElement | SVGElement>> {
    const viewport = this.getViewport();
    const indexesList = viewport.getSortedIndexesList(
      this.getSelectedTargets()
    );
    const indexesListLength = indexesList.length;
    let appendIndex = -1;
    let scopeId: string = "";

    if (!isRestore && indexesListLength) {
      const indexes = indexesList[indexesListLength - 1];

      const info = viewport.getInfoByIndexes(indexes);

      scopeId = info.scopeId!;
      appendIndex = indexes[indexes.length - 1] + 1;
    }

    this.console.log("append jsxs", jsxs, appendIndex, scopeId);

    return this.getViewport()
      .appendJSXs(jsxs, appendIndex, scopeId)
      .then(({ added }) => {
        return this.appendComplete(added, isRestore);
      });
  }

  public appendComplete(infos: ElementInfo[], isRestore?: boolean) {
    !isRestore &&
      this.historyManager.addAction("createElements", {
        infos,
        prevSelected: getIds(this.getSelectedTargets()),
      });
    const data = this.moveableData;
    const targets = infos
      .map(function registerFrame(info) {
        data.createFrame(info.el!, info.frame);
        data.render(info.el!);

        info.children!.forEach(registerFrame);
        return info.el!;
      })
      .filter((el) => el);

    return Promise.all(targets.map((target) => checkImageLoaded(target))).then(
      () => {
        this.setSelectedTargets(targets, true);

        return targets;
      }
    );
  }
  public removeByIds(ids: string[], isRestore?: boolean) {
    return this.removeElements(this.getViewport().getElements(ids), isRestore);
  }
  public getMoveable() {
    return this.moveableManager.current!.getMoveable();
  }
  public removeFrames(targets: Array<HTMLElement | SVGElement>) {
    const frameMap: IObject<any> = {};
    const moveableData = this.moveableData;
    const viewport = this.getViewport();

    targets.forEach(function removeFrame(target) {
      const info = viewport.getInfoByElement(target)!;

      frameMap[info.id!] = moveableData.getFrame(target).get();
      moveableData.removeFrame(target);

      info.children!.forEach((childInfo) => {
        removeFrame(childInfo.el!);
      });
    });

    return frameMap;
  }
  public restoreFrames(infos: ElementInfo[], frameMap: IObject<any>) {
    const viewport = this.getViewport();
    const moveableData = this.moveableData;

    infos.forEach(function registerFrame(info) {
      info.frame = frameMap[info.id!];
      delete frameMap[info.id!];

      info.children!.forEach(registerFrame);
    });
    for (const id in frameMap) {
      moveableData.createFrame(viewport.getInfo(id).el!, frameMap[id]);
    }
  }
  public removeElements(
    targets: Array<HTMLElement | SVGElement>,
    isRestore?: boolean
  ) {
    const viewport = this.getViewport();
    const frameMap = this.removeFrames(targets);
    const indexesList = viewport.getSortedIndexesList(targets);
    const indexesListLength = indexesList.length;
    let scopeId = "";
    let selectedInfo: ElementInfo | null = null;

    if (indexesListLength) {
      const lastInfo = viewport.getInfoByIndexes(
        indexesList[indexesListLength - 1]
      );
      const nextInfo = viewport.getNextInfo(lastInfo.id!);

      scopeId = lastInfo.scopeId!;
      selectedInfo = nextInfo;
    }
    // return;
    return viewport.removeTargets(targets).then(({ removed }) => {
      let selectedTarget =
        selectedInfo ||
        viewport.getLastChildInfo(scopeId)! ||
        viewport.getInfo(scopeId);

      this.setSelectedTargets(
        selectedTarget && selectedTarget.el ? [selectedTarget.el!] : [],
        true
      );

      this.console.log("removeTargets", removed);
      !isRestore &&
        this.historyManager.addAction("removeElements", {
          infos: removed.map(function removeTarget(
            info: ElementInfo
          ): ElementInfo {
            return {
              ...info,
              children: info.children!.map(removeTarget),
              frame: frameMap[info.id!] || info.frame,
            };
          }),
        });
      return targets;
    });
  }
  public setProperty(scope: string[], value: any, isUpdate?: boolean) {
    const infos = this.moveableData.setProperty(scope, value);
    this.historyManager.addAction("renders", { infos });
    if (isUpdate) {
      this.moveableManager.current!.updateRect();
    }
    this.eventBus.requestTrigger("render");
  }

  public loadDatas(datas: SavedScenaData[]) {
    const viewport = this.getViewport();
    return this.appendJSXs(
      datas
        .map(function loadData(data): any {
          const { componentId, jsxId, children } = data;

          let jsx!: ScenaJSXElement;

          if (jsxId) {
            jsx = viewport.getJSX(jsxId);
          }
          if (!jsx && componentId) {
            const Component = viewport.getComponent(componentId);

            jsx = <Component />;
          }
          if (!jsx) {
            jsx = React.createElement(data.tagName);
          }
          return {
            ...data,
            children: children.map(loadData),
            jsx,
          };
        })
        .filter((info) => info) as ElementInfo[]
    );
  }
  public saveTargets(
    targets: Array<HTMLElement | SVGElement>
  ): SavedScenaData[] {
    const viewport = this.getViewport();
    const moveableData = this.moveableData;
    this.console.log("save targets", targets);
    return targets
      .map((target) => viewport.getInfoByElement(target))
      .map(function saveTarget(info): SavedScenaData {
        const target = info.el!;
        const isContentEditable = info.attrs!.contenteditable;
        return {
          name: info.name,
          attrs: getScenaAttrs(target),
          jsxId: info.jsxId || "",
          componentId: info.componentId!,
          innerHTML: isContentEditable ? "" : target.innerHTML,
          innerText: isContentEditable ? (target as HTMLElement).innerText : "",
          tagName: target.tagName.toLowerCase(),
          frame: moveableData.getFrame(target).get(),
          children: info.children!.map(saveTarget),
        };
      });
  }
  public getViewport() {
    return this.viewport.current!;
  }
  public getViewportInfos() {
    return this.getViewport().getViewportInfos();
  }
  public appendBlob(blob: Blob) {
    const url = URL.createObjectURL(blob);

    return this.appendJSX({
      jsx: <img src={url} alt="appended blob" />,
      name: "(Image)",
    });
  }
  public moves(movedInfos: MovedInfo[], isRestore?: boolean) {
    const frameMap = this.removeFrames(movedInfos.map(({ info }) => info.el!));

    return this.getViewport()
      .moves(movedInfos)
      .then((result) => this.moveComplete(result, frameMap, isRestore));
  }

  private move(deltaX: number, deltaY: number) {
    this.getMoveable().request("draggable", { deltaX, deltaY }, true);
  }
  private checkBlur() {
    const activeElement = document.activeElement as HTMLElement;
    activeElement?.blur();

    const selection = document.getSelection()!;
    selection?.removeAllRanges();
  }
  private onResize = () => {
    this.horizontalGuides.current!.resize();
    this.verticalGuides.current!.resize();
  };

  private moveComplete(
    result: MovedResult,
    frameMap: IObject<any>,
    isRestore?: boolean
  ) {
    this.console.log("Move", result);

    const { moved, prevInfos, nextInfos } = result;
    this.restoreFrames(moved, frameMap);

    if (moved.length) {
      if (!isRestore) {
        this.historyManager.addAction("move", {
          prevInfos,
          nextInfos,
        });
      }
      // move complete
      this.appendComplete(moved, true);
    }

    return result;
  }
}
export default Editor;

// export default React.forwardRef((props: IEditorProps) => (
//     <Editor {...defaultProps} {...props} />
// ));
