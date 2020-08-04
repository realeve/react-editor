import * as React from "react";
import "./App.css";
import Editor, { generateId, KeyboardIcon } from "../Editor";

const App = () => {
    const editor = React.useRef<Editor>(null);
    const [instance, setInstance] = React.useState<Editor | null>(null);
    React.useEffect(() => {
        editor.current && setInstance(editor.current);
    }, [editor]);

    return (
        <div className="app">
            <button
                onClick={() => {
                    instance!.append(<div>一个新的面板</div>, generateId());
                }}
            >
                添加
            </button>
            <div
                style={{
                    backgroundColor: "#2a2a2a",
                    width: 33,
                    height: 33,
                    padding: 5,
                }}
            >
                {instance && <KeyboardIcon editor={instance} />}
            </div>
            <Editor
                ref={editor}
                debug={true}
                style={{
                    width: "100%",
                    height: 800,
                }}
                onRemove={(e) => {
                    console.log("移除", e);
                }}
                onSelect={(e) => {
                    console.log("选中了", e);
                }}
                onChange={e=>{
                    console.log("变更",e)
                }}
            />
        </div>
    );
};

export default App;
