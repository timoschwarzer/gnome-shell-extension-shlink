/** Credit:
 *  based off prefs.js from the gnome shell extensions repository at
 *  git.gnome.org/browse/gnome-shell-extensions
 */

const GObject = imports.gi.GObject
const Gio = imports.gi.Gio
const Gtk = imports.gi.Gtk
const Lang = imports.lang
const ExtensionUtils = imports.misc.extensionUtils;

const SHORTEN_AND_COPY_KEY = 'shorten-and-copy-shortcut'
const INSTANCE_URL_KEY = 'instance-url'
const API_KEY_KEY = 'api-key'

const ShlinkKeybindingsWidget = new GObject.Class({
  Name: 'Shlink.Keybindings.Widget',
  GTypeName: 'ShlinkKeybindingsWidget',
  Extends: Gtk.Box,

  _init(keybindings) {
    this.parent()
    this.set_orientation(Gtk.Orientation.VERTICAL)

    this._keybindings = keybindings
    this._settings = ExtensionUtils.getSettings()

    let scrolled_window = new Gtk.ScrolledWindow()
    scrolled_window.set_policy(
      Gtk.PolicyType.AUTOMATIC,
      Gtk.PolicyType.AUTOMATIC
    )

    this._columns = {
      NAME: 0,
      ACCEL_NAME: 1,
      MODS: 2,
      KEY: 3
    }

    this._store = new Gtk.ListStore()
    this._store.set_column_types([
      GObject.TYPE_STRING,
      GObject.TYPE_STRING,
      GObject.TYPE_INT,
      GObject.TYPE_INT
    ])

    this._tree_view = new Gtk.TreeView({
      model: this._store,
      hexpand: true,
      vexpand: true
    })
    this._tree_view.get_selection().set_mode(Gtk.SelectionMode.SINGLE)

    let action_renderer = new Gtk.CellRendererText()
    let action_column = new Gtk.TreeViewColumn({
      'title': 'Action',
      'expand': true
    })
    action_column.pack_start(action_renderer, true)
    action_column.add_attribute(action_renderer, 'text', 1)
    this._tree_view.append_column(action_column)

    let keybinding_renderer = new Gtk.CellRendererAccel({
      'editable': true,
      'accel-mode': Gtk.CellRendererAccelMode.GTK
    })
    keybinding_renderer.connect('accel-edited',
      Lang.bind(this, function (renderer, iter, key, mods) {
        let value = Gtk.accelerator_name(key, mods)
        let [success, iterator] =
          this._store.get_iter_from_string(iter)

        if (!success) {
          printerr('Can\'t change keybinding')
        }

        let name = this._store.get_value(iterator, 0)

        this._store.set(
          iterator,
          [this._columns.MODS, this._columns.KEY],
          [mods, key]
        )
        this._settings.set_strv(name, [value])
      })
    )

    let keybinding_column = new Gtk.TreeViewColumn({
      'title': 'Modify'
    })
    keybinding_column.pack_end(keybinding_renderer, false)
    keybinding_column.add_attribute(
      keybinding_renderer,
      'accel-mods',
      this._columns.MODS
    )
    keybinding_column.add_attribute(
      keybinding_renderer,
      'accel-key',
      this._columns.KEY
    )
    this._tree_view.append_column(keybinding_column)

    scrolled_window.add(this._tree_view)
    this.add(scrolled_window)

    this._refresh()
  },

  _refresh: function () {
    this._store.clear()

    for (let settings_key in this._keybindings) {
      if (!this._keybindings.hasOwnProperty(settings_key)) {
        continue
      }

      let [key, mods] = Gtk.accelerator_parse(
        this._settings.get_strv(settings_key)[0]
      )

      let iter = this._store.append()
      this._store.set(iter,
        [
          this._columns.NAME,
          this._columns.ACCEL_NAME,
          this._columns.MODS,
          this._columns.KEY
        ],
        [
          settings_key,
          this._keybindings[settings_key],
          mods,
          key
        ]
      )
    }
  }
})

const ShlinkPrefsGrid = new GObject.Class({
  Name: 'Shlink.Prefs.Grid',
  GTypeName: 'ShlinkPrefsGrid',
  Extends: Gtk.Grid,

  _init(params) {
    this.parent(params)

    this.margin = this.row_spacing = this.column_spacing = 10
    this._rownum = 0
    Gtk.Settings.get_default().gtk_button_images = true

    this._settings = ExtensionUtils.getSettings()
  },

  add_entry: function (text, key) {
    let item = new Gtk.Entry({
      hexpand: true
    })
    item.text = this._settings.get_string(key)
    this._settings.bind(key, item, 'text', Gio.SettingsBindFlags.DEFAULT)

    return this.add_row(text, item)
  },

  add_row: function (text, widget, wrap) {
    let label = new Gtk.Label({
      label: text,
      use_markup: true,
      hexpand: true,
      halign: Gtk.Align.START
    })
    label.set_line_wrap(wrap || false)

    this.attach(label, 0, this._rownum, 1, 1) // col, row, colspan, rowspan
    this.attach(widget, 1, this._rownum, 1, 1)
    this._rownum++

    return widget
  },

  add_item: function (widget, col, colspan, rowspan) {
    this.attach(
      widget,
      col || 0,
      this._rownum,
      colspan || 2,
      rowspan || 1
    )
    this._rownum++

    return widget
  }
})

const ShlinkPrefsWidget = new GObject.Class({
  Name: 'Shlink.Prefs.Widget',
  GTypeName: 'ShlinkPrefsWidget',
  Extends: Gtk.Box,

  _init: function (params) {
    this.parent(params)
    this._settings = ExtensionUtils.getSettings()

    let main_page = this._get_main_page()

    let notebook = new Gtk.Notebook({
      margin_left: 5,
      margin_top: 5,
      margin_bottom: 5,
      margin_right: 5,
      expand: true
    })

    notebook.append_page(main_page.page, main_page.label)

    this.add(notebook)
  },

  _get_main_page: function () {
    let page_label = new Gtk.Label({
      label: 'Settings'
    })
    let page = new ShlinkPrefsGrid()

    page.add_entry(
      'Shlink instance:',
      INSTANCE_URL_KEY
    )
    page.add_entry(
      'API key:',
      API_KEY_KEY
    )

    let keybindings = {}
    keybindings[SHORTEN_AND_COPY_KEY] = 'Shorten URL in clipboard'

    let keybindings_widget = new ShlinkKeybindingsWidget(
      keybindings
    )
    page.add_item(keybindings_widget)

    return {
      label: page_label,
      page: page
    }
  },
})

function init() {
  // nothing
}

function buildPrefsWidget() {
  const widget = new ShlinkPrefsWidget()
  widget.show_all()

  return widget
}