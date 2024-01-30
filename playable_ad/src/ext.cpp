
#include <dmsdk/sdk.h>

#if defined(DM_PLATFORM_HTML5)
#include <emscripten/emscripten.h>
#include <emscripten/html5.h>

typedef void (*DefMraid_OnViewableChange)(const int viewable);
extern "C" void DefMraid_SetCallback(DefMraid_OnViewableChange callback);
extern "C" bool DefMraid_IsViewable();

static dmScript::LuaCallbackInfo* m_ListenerCallback = 0;

enum MraidEvent
{
    EVENT_VIEWABLE_CHANGE = 0,
};

static void Mraid_OnViewableChange(const int viewable)
{
    if (!m_ListenerCallback) {
        return;
    }

    lua_State* L = dmScript::GetCallbackLuaContext(m_ListenerCallback);
    DM_LUA_STACK_CHECK(L, 0);

    if (!dmScript::SetupCallback(m_ListenerCallback))
    {
        return;
    }

    lua_pushnumber(L, EVENT_VIEWABLE_CHANGE);

    lua_newtable(L);
    lua_pushstring(L, "viewable");
    lua_pushboolean(L, viewable == 1);
    lua_rawset(L, -3);

    dmScript::PCall(L, 3, 0); // self + # user arguments

    dmScript::TeardownCallback(m_ListenerCallback);
}

/*# sets a mraid event listener
 * Sets a mraid event listener.
 *
 * @name mraid.set_listener
 *
 * @param callback [type:function(self, event, data)|nil] A callback which receives info about mraid events. Pass an empty function or `nil` if you no longer wish to receive callbacks.
 *
 * `self`
 * : [type:object] The calling script
 *
 * `event`
 * : [type:constant] The type of event. Can be one of these:
 *
 * - `mraid.EVENT_VIEWABLE_CHANGE`
 * - `mraid.EVENT_VIEWABLE_CHANGE`
 *
 * `data`
 * : [type:table] The callback value `data` is a table which currently holds these values:
 *
 * - [type:boolean] `viewable`.
 *
 * @examples
 *
 * ```lua
 * local function mraid_callback(self, event, data)
 *     if event == mraid.EVENT_VIEWABLE_CHANGE then
 *         print("mraid.EVENT_VIEWABLE_CHANGE:", data.viewable)
 *     end
 * end
 *
 * function init(self)
 *     if mraid then
 *         mraid.set_listener(mraid_callback)
 *     end
 * end
 * ```
 */
static int Mraid_SetListener(lua_State* L)
{
    luaL_checkany(L, 1);

    if (lua_isnil(L, 1))
    {
        if (m_ListenerCallback)
            dmScript::DestroyCallback(m_ListenerCallback);
        m_ListenerCallback = 0;
        return 0;
    }

    if (m_ListenerCallback)
        dmScript::DestroyCallback(m_ListenerCallback);
    m_ListenerCallback = dmScript::CreateCallback(L, 1);

    if (!dmScript::IsCallbackValid(m_ListenerCallback))
        return luaL_error(L, "Failed to create callback");

    return 0;
}

static int Mraid_IsViewable(lua_State* L)
{
    DM_LUA_STACK_CHECK(L, 1);
    lua_pushboolean(L, DefMraid_IsViewable());
    return 1;
}

// Functions exposed to Lua
static const luaL_reg Mraid_methods[] = {
    { "set_listener", Mraid_SetListener },
    { "is_viewable", Mraid_IsViewable },
    /* Sentinel: */
    { NULL, NULL }
};

static void Mraid_LuaInit(lua_State* L)
{
    const int has_mraid = EM_ASM_INT(
        return window.mraid ? 1 : 0;
    );
    if (!has_mraid) {
        return;
    }

    int top = lua_gettop(L);

    // Register lua names
    luaL_register(L, "mraid", Mraid_methods);

#define SETCONSTANT(name) \
        lua_pushnumber(L, (lua_Number) name); \
        lua_setfield(L, -2, #name);\

    SETCONSTANT(EVENT_VIEWABLE_CHANGE)

#undef SETCONSTANT

    lua_pop(L, 1);
    assert(top == lua_gettop(L));
}
#endif

static dmExtension::Result InitializeExt(dmExtension::Params* params)
{
#if defined(DM_PLATFORM_HTML5)
    Mraid_LuaInit(params->m_L);
    DefMraid_SetCallback(Mraid_OnViewableChange);
#endif

    return dmExtension::RESULT_OK;
}

static dmExtension::Result FinalizeExt(dmExtension::Params* params)
{
#if defined(DM_PLATFORM_HTML5)
    if (m_ListenerCallback)
        dmScript::DestroyCallback(m_ListenerCallback);
    m_ListenerCallback = 0;
    DefMraid_SetCallback(0);
#endif

    return dmExtension::RESULT_OK;
}

DM_DECLARE_EXTENSION(playable_ad, "playable_ad", 0, 0, InitializeExt, 0, 0, FinalizeExt)
