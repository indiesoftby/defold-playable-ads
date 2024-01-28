var LibraryDefMraid = {
  $DefMraid: {
    viewableChangeFunc: null,

    onViewableChange: function (viewable) {
      if (DefMraid.viewableChangeFunc) {
        {{{ makeDynCall('vi', 'DefMraid.viewableChangeFunc') }}}(viewable);
      }
    },
  },

  DefMraid_SetCallback: function (cbfun) {
    DefMraid.viewableChangeFunc = cbfun;
    return 1;
  },
};

autoAddDeps(LibraryDefMraid, '$DefMraid');
mergeInto(LibraryManager.library, LibraryDefMraid);
