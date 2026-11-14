"""Adapt the supplied Game::Run loop without replacing any frame services."""
def adapt_cpp(text):
    start=text.index('void Game::Run()')
    clock=text.index('    unsigned time = radTimeGetMilliseconds();',start)
    loop='    while( !mExitNow )\n    {'
    body_start=text.index(loop,clock)+len(loop)
    body_end=text.index('        END_PROFILER_FRAME();',body_start)+len('        END_PROFILER_FRAME();')
    closing='\n    }\n}'
    if not text[body_end:].startswith(closing):raise ValueError('Unexpected original loop layout')
    end=body_end+len(closing)
    prefix=text[start:clock]
    body=text[body_start:body_end]
    browser=prefix+'''    mBrowserLastTime = radTimeGetMilliseconds();
    emscripten_set_main_loop_arg([](void* game) {
        static_cast<Game*>(game)->TickBrowser();
    }, this, 0, true);
}

void Game::TickBrowser()
{
    extern bool g_AllowDebugOutput;
    if (mExitNow) { emscripten_cancel_main_loop(); return; }
    unsigned& time = mBrowserLastTime;'''+body+'''
    if (mExitNow) { emscripten_cancel_main_loop(); }
}
'''
    # Retain the original method for all other platforms, unchanged.
    return '#ifdef RAD_WEB\n#include <emscripten/emscripten.h>\n#endif\n'+text[:start]+'#ifdef RAD_WEB\n'+browser+'#else\n'+text[start:end]+'\n#endif\n'+text[end:]

def adapt_hpp(text):
    marker='        void Run();'
    if marker not in text:raise ValueError('Original Game::Run declaration missing')
    text=text.replace(marker,marker+'\n#ifdef RAD_WEB\n        void TickBrowser();\n#endif')
    marker='        bool        mExitNow;'
    if marker not in text:raise ValueError('Original Game::mExitNow declaration missing')
    return text.replace(marker,marker+'\n#ifdef RAD_WEB\n        unsigned mBrowserLastTime = 0;\n#endif')
