import * as React from "react";
import Moveable, { MoveableManagerInterface } from "react-moveable";
import { connectEditorProps, getId } from "../utils/utils";
import Editor from "../Editor";
import { EditorInterface } from "../types";
import { IObject } from "@daybrush/utils";
import { diff } from "@egjs/list-differ";

function restoreRender(
    id: string,
    state: IObject<any>,
    prevState: IObject<any>,
    editor: Editor
) {
    const el = editor.viewport.current!.getElement(id);

    if (!el) {
        console.error("No Element");
        return false;
    }
    const moveableData = editor.moveableData;
    const frame = moveableData.getFrame(el);

    frame.clear();
    frame.set(state);

    const result = diff(Object.keys(prevState), Object.keys(state));
    const { removed, prevList } = result;

    removed.forEach((index) => {
        el.style.removeProperty(prevList[index]);
    });
    moveableData.render(el);
    return true;
}
function undoRender({ id, prev, next }: IObject<any>, editor: Editor) {
    if (!restoreRender(id, prev, next, editor)) {
        return;
    }
    editor.moveableManager.current!.updateRect();
    editor.eventBus.trigger("render");
}
function redoRender({ id, prev, next }: IObject<any>, editor: Editor) {
    if (!restoreRender(id, next, prev, editor)) {
        return;
    }
    editor.moveableManager.current!.updateRect();
    editor.eventBus.trigger("render");
}
function undoRenders({ infos }: IObject<any>, editor: Editor) {
    infos.forEach(({ id, prev, next }: IObject<any>) => {
        restoreRender(id, prev, prev, editor);
    });
    editor.moveableManager.current!.updateRect();
    editor.eventBus.trigger("render");
}
function redoRenders({ infos }: IObject<any>, editor: Editor) {
    infos.forEach(({ id, next, prev }: IObject<any>) => {
        restoreRender(id, next, prev, editor);
    });
    editor.moveableManager.current!.updateRect();
    editor.eventBus.trigger("render");
}

export interface DimensionViewableProps {
    dimensionViewable?: boolean;
}
const DimensionViewable = {
    name: "dimensionViewable",
    props: {
        dimensionViewable: Boolean,
    },
    events: {},
    render(moveable: MoveableManagerInterface) {
        const { left, top } = moveable.state;

        const rect = moveable.getRect();

        return (
            <div
                key={"dimension-viewer"}
                className={"moveable-dimension"}
                style={{
                    left: `${rect.left + rect.width / 2 - left}px`,
                    top: `${rect.top + rect.height + 20 - top}px`,
                }}
            >
                {Math.round(rect.offsetWidth)} x {Math.round(rect.offsetHeight)}
            </div>
        );
    },
};
@connectEditorProps
export default class MoveableManager extends React.PureComponent<{
    editor: Editor;
    selectedTargets: Array<HTMLElement | SVGElement>; 
    verticalGuidelines: number[];
    horizontalGuidelines: number[];
    onChange?: (name: { id: string; next: {} }[]) => void;
}> {
    public moveable = React.createRef<Moveable>();
    public getMoveable() {
        return this.moveable.current!;
    }
    public render() {
        const {
            editor,
            verticalGuidelines,
            horizontalGuidelines,
            selectedTargets, 
        } = this.props; 

        if (!selectedTargets.length) {
            return this.renderViewportMoveable();
        }
        const { moveableData, keyManager, eventBus, selecto, memory } = editor;
        const elementGuidelines = [...moveableData.getTargets()].filter(
            (el) => {
                return selectedTargets.indexOf(el) === -1;
            }
        );
        const isShift = keyManager.shiftKey;

        return (
            <Moveable<DimensionViewableProps>
                ables={[DimensionViewable]}
                ref={this.moveable}
                targets={selectedTargets}
                dimensionViewable={true}
                draggable={true}
                resizable={true}
                throttleResize={1}
                clippable={false}
                dragArea={selectedTargets.length > 1}
                checkInput={false}
                throttleDragRotate={isShift ? 45 : 0}
                keepRatio={isShift}
                rotatable={true}
                snappable={true}
                snapCenter={true}
                snapGap={false}
                roundable={true}
                verticalGuidelines={verticalGuidelines}
                horizontalGuidelines={horizontalGuidelines}
                elementGuidelines={elementGuidelines}
                clipArea={true}
                onDragStart={moveableData.onDragStart}
                onDrag={moveableData.onDrag}
                onDragGroupStart={moveableData.onDragGroupStart}
                onDragGroup={moveableData.onDragGroup}
                onScaleStart={moveableData.onScaleStart}
                onScale={moveableData.onScale}
                onScaleGroupStart={moveableData.onScaleGroupStart}
                onScaleGroup={moveableData.onScaleGroup}
                onResizeStart={moveableData.onResizeStart}
                onResize={moveableData.onResize}
                onResizeGroupStart={moveableData.onResizeGroupStart}
                onResizeGroup={moveableData.onResizeGroup}
                onRotateStart={moveableData.onRotateStart}
                onRotate={moveableData.onRotate}
                onRotateGroupStart={moveableData.onRotateGroupStart}
                onRotateGroup={moveableData.onRotateGroup}
                defaultClipPath={memory.get("crop") || "inset"}
                onClip={moveableData.onClip}
                onDragOriginStart={moveableData.onDragOriginStart}
                onDragOrigin={(e) => {
                    moveableData.onDragOrigin(e);
                }}
                onRound={moveableData.onRound}
        
                onClickGroup={(e) => {
                    selecto.current!.clickTarget(e.inputEvent, e.inputTarget);
                }}
                onRenderStart={(e) => {
                    e.datas.prevData = moveableData.getFrame(e.target).get();
                }}
                onRender={(e) => {
                    e.datas.isRender = true;
                    eventBus.requestTrigger("render");
                }}
                onRenderEnd={(e) => {
                    eventBus.requestTrigger("render");

                    if (!e.datas.isRender) {
                        return;
                    }
                    const item = {
                        id: getId(e.target),
                        next: moveableData.getFrame(e.target).get(),
                    };
                    this.props.onChange?.([item]);
                    this.historyManager.addAction("render", {
                        ...item,
                        prev: e.datas.prevData,
                    });
                }}
                onRenderGroupStart={(e) => {
                    e.datas.prevDatas = e.targets.map((target) =>
                        moveableData.getFrame(target).get()
                    );
                }}
                onRenderGroup={(e) => {
                    eventBus.requestTrigger("renderGroup", e);
                    e.datas.isRender = true;
                }}
                onRenderGroupEnd={(e) => {
                    eventBus.requestTrigger("renderGroup", e);

                    if (!e.datas.isRender) {
                        return;
                    }
                    const prevDatas = e.datas.prevDatas;
                    const infos = e.targets.map((target, i) => {
                        return {
                            id: getId(target),
                            prev: prevDatas[i],
                            next: moveableData.getFrame(target).get(),
                        };
                    });
                    
                    this.props.onChange?.(infos.map(({id,next})=>({id,next})));
                    this.historyManager.addAction("renders", {
                        infos,
                    });
                }}
            ></Moveable>
        );
    }
    public renderViewportMoveable() {
        const moveableData = this.moveableData;
        const viewport = this.editor.getViewport();
        const target = viewport ? viewport.viewportRef.current! : null;

        return (
            <Moveable
                ref={this.moveable}
                rotatable={true}
                target={target}
                origin={false}
                onRotateStart={moveableData.onRotateStart}
                onRotate={moveableData.onRotate}
            ></Moveable>
        );
    }
    public componentDidMount() {
        this.historyManager.registerType("render", undoRender, redoRender);
        this.historyManager.registerType("renders", undoRenders, redoRenders);
        this.keyManager.keydown(["shift"], () => {
            this.forceUpdate();
        });
        this.keyManager.keyup(["shift"], () => {
            this.forceUpdate();
        });
    }
    public updateRect() {
        this.getMoveable().updateRect();
    }
}
export default interface MoveableManager extends EditorInterface {}
